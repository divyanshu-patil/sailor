"""
Script generation, stripped to one direct Ollama call.

What used to be here: a plan call that returned JSON, seven beat calls fanned
out across a thread pool, per-beat undershoot repair, de-list repair, a
provider abstraction over four vendors, an adaptive rate limiter, and a fallback
model. All of it is gone. This module now builds one prompt, sends it to Ollama,
and returns what comes back.

The prompts themselves were left alone — `build_plan_prompt` and
`build_section_prompt` are still in prompts.py, untouched, so the staged
pipeline can be rebuilt on top of them without rewriting a single instruction.

Everything this module does is logged: the model, the prompt it sent, how long
the call took, and the raw text that came back.
"""

import logging
import re
import time
from functools import lru_cache
from typing import Sequence

from app.config.settings import settings
from app.services.ai.prompts import build_whole_script_prompt
from app.services.ai.providers.base import ImageInput
from app.utils.enums.deck_enums import AudienceType

logger = logging.getLogger("celery")

OLLAMA_CLOUD_HOST = "https://ollama.com"

# The model is asked to open with this line; everything after it is the script.
TITLE_LINE_PATTERN = re.compile(r"^\s*TITLE:\s*(.+?)\s*$", re.MULTILINE)


class ScriptGenerationError(Exception):
    """Raised when the model could not produce a script."""


@lru_cache(maxsize=None)
def _client(host: str, api_key: str, timeout: float):
    """One client for the process — see the note in ollama_provider: building it
    per call meant a fresh TLS handshake every time, and no timeout meant a
    wedged request could hang until Celery killed the task."""
    from ollama import Client

    return Client(
        host=host,
        headers={"Authorization": f"Bearer {api_key}"},
        timeout=timeout,
    )


def _call_ollama(messages: list[dict], images: Sequence[ImageInput]) -> str:
    """One request. No retries, no fallback model, no rate limiter."""
    model = settings.AI_MODEL
    if not model:
        raise ScriptGenerationError("No model configured — set AI_MODEL.")

    payload = [dict(message) for message in messages]
    if images:
        for message in reversed(payload):
            if message.get("role") == "user":
                message["images"] = [image.base64_data for image in images]
                break

    logger.info("=" * 72)
    logger.info(f"[ai] MODEL   : {model}")
    logger.info(f"[ai] HOST    : {settings.OLLAMA_HOST or OLLAMA_CLOUD_HOST}")
    logger.info(f"[ai] IMAGES  : {len(images)}")
    for message in payload:
        role = message.get("role", "?").upper()
        logger.info(f"[ai] --- {role} PROMPT ---\n{message.get('content', '')}")
    logger.info("=" * 72)

    started = time.perf_counter()
    try:
        response = _client(
            settings.OLLAMA_HOST or OLLAMA_CLOUD_HOST,
            settings.OLLAMA_API_KEY,
            settings.AI_REQUEST_TIMEOUT,
        ).chat(model=model, messages=payload, stream=False)
    except Exception as exc:
        elapsed = time.perf_counter() - started
        logger.error(f"[ai] FAILED after {elapsed:.2f}s: {type(exc).__name__}: {exc}")
        raise ScriptGenerationError(f"'{model}' failed: {exc}") from exc

    elapsed = time.perf_counter() - started
    content = (response.get("message", {}) or {}).get("content", "").strip()

    logger.info(f"[ai] RESPONSE in {elapsed:.2f}s — {len(content)} chars, {len(content.split())} words")
    logger.info(f"[ai] --- RAW RESPONSE ---\n{content}")
    logger.info("=" * 72)

    if not content:
        raise ScriptGenerationError(f"'{model}' returned empty content")
    return content


# --- title -----------------------------------------------------------------
#
# Kept rather than deleted: the deck grid renders a title on every card, so
# something has to produce one even when the model ignores the instruction.

_BRIEF_PREAMBLE = re.compile(
    r"^\s*(?:i(?:'d| would)? (?:want|like|need) to (?:talk|present|speak|do a talk) "
    r"(?:about|on)|i(?:'m| am) (?:presenting|talking|doing a talk) (?:about|on)|"
    r"(?:this is |it's |its )?(?:a |an |my )?(?:presentation|talk|pitch|deck|speech) "
    r"(?:about|on|regarding)|(?:talk|present|speak) about|about)\s+",
    re.IGNORECASE,
)

MAX_TITLE_WORDS = 4

_TITLE_LEAD_FILLER = {
    "a", "an", "the", "how", "why", "what", "when", "understanding",
    "exploring", "introduction", "intro", "overview", "guide", "rethinking",
    "unlocking", "navigating", "mastering", "towards", "toward", "on",
}
_TITLE_JOINERS = {
    "to", "of", "in", "on", "at", "by", "from", "for", "and", "or", "but",
    "with", "into", "over", "under", "your", "our", "their", "its", "a", "an",
    "the", "that", "as",
}


def _shorten_title(raw: str) -> str:
    """Trim a title to MAX_TITLE_WORDS, keeping the subject rather than the
    run-up to it."""
    cleaned = raw.strip().strip("\"'")
    cleaned = re.split(r"\s*[:–—]\s+|\s+[-–—]\s+", cleaned, maxsplit=1)[0]
    cleaned = cleaned.rstrip(".!?:;,-–—").strip()
    words = cleaned.split()
    if len(words) <= MAX_TITLE_WORDS:
        return " ".join(words) or "Untitled Presentation"

    kept = words[:MAX_TITLE_WORDS]
    while kept and kept[-1].lower() in _TITLE_JOINERS:
        kept.pop()
    return " ".join(kept) or " ".join(words[:MAX_TITLE_WORDS])


def _fallback_title(description: str) -> str:
    """Derived from the brief when the model didn't give a TITLE line."""
    first_sentence = _BRIEF_PREAMBLE.sub("", description.strip()).split(".")[0]
    if not first_sentence.split():
        return "Untitled Presentation"
    return _shorten_title(first_sentence)


def _split_title(raw: str, description: str) -> tuple[str, str]:
    """Pull the TITLE line off the front. Whatever is left is the script."""
    match = TITLE_LINE_PATTERN.search(raw)
    if not match:
        logger.warning("[ai] no TITLE line in response, deriving one from the brief")
        return _fallback_title(description), raw.strip()

    title = _shorten_title(match.group(1))
    script = (raw[: match.start()] + raw[match.end() :]).strip()
    return title, script


def generate_script(
    description: str,
    duration_mins: int,
    audience: AudienceType,
    images: Sequence[ImageInput] = (),
    source_text: str | None = None,
    links: str | None = None,
) -> tuple[str, str]:
    """Returns (title, script). One prompt in, one script out."""
    logger.info(
        f"[ai] generate_script: {duration_mins}min, audience={audience.value}, "
        f"images={len(images)}, source_text={'yes' if source_text else 'no'}, "
        f"links={'yes' if links else 'no'}"
    )
    logger.info(f"[ai] BRIEF: {description}")

    messages = build_whole_script_prompt(
        description, duration_mins, audience, source_text=source_text, links=links
    )
    raw = _call_ollama(messages, images)
    title, script = _split_title(raw, description)

    logger.info(f"[ai] TITLE : {title}")
    logger.info(f"[ai] SCRIPT: {len(script.split())} words")
    return title, script
