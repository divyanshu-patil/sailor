"""
Script generation: one model call, whatever the configured provider is.

What used to be here: a plan call that returned JSON, seven beat calls fanned
out across a thread pool, per-beat undershoot repair and de-list repair. That
architecture is gone and is what made a generation take minutes — one call for
the whole script is the shape now.

What is *not* gone is the plumbing around the call. This goes through `chat()`,
so it inherits provider neutrality (ollama, anthropic, openai, gemini), the
fallback model, the shared concurrency limiter and rate-limit backoff. None of
that costs latency on a healthy call; all of it is what stops a burst of users
turning into 429s.

The prompts were left alone — `build_plan_prompt` and `build_section_prompt`
are still in prompts.py, untouched, so the staged pipeline can be rebuilt on top
of them without rewriting a single instruction.

Everything this module does is logged: the provider and models in play, the
prompt it sent, how long the call took, and the raw text that came back.
"""

import logging
import re
import time
from typing import Sequence

from app.config.settings import settings
from app.services.ai.chat import ModelCallError, chat, provider_chain
from app.services.ai.prompts import build_revision_prompt, build_whole_script_prompt
from app.services.ai.providers.base import ImageInput
from app.utils.enums.deck_enums import AudienceType
from app.utils.enums.user_enums import ExperienceLevel, Profession, ScriptMood

logger = logging.getLogger("celery")

# The model is asked to open with this line; everything after it is the script.
TITLE_LINE_PATTERN = re.compile(r"^\s*TITLE:\s*(.+?)\s*$", re.MULTILINE)


class ScriptGenerationError(Exception):
    """Raised when no configured model could produce a script."""


# A revision that comes back shorter than this fraction of the original has
# deleted the presenter's content rather than edited it. Losing the requested
# edit is recoverable; losing their script is not.
MIN_REVISION_RETENTION = 0.6


def _call_model(messages: list[dict], images: Sequence[ImageInput]) -> str:
    """One completion, logged end to end.

    `chat()` owns which provider and model answer it, and what happens when the
    provider pushes back — this owns saying what went in and what came out.
    """
    chain = provider_chain()

    logger.info("=" * 72)
    logger.info(f"[ai] PROVIDER: {' -> '.join(p.name for p in chain)}")
    for provider in chain:
        logger.info(f"[ai] MODELS  : {provider.name} {provider.models()} (first is primary)")
    logger.info(f"[ai] FAST    : {settings.AI_FAST} | TIMEOUT: {settings.AI_REQUEST_TIMEOUT}s")
    logger.info(f"[ai] IMAGES  : {len(images)}")
    for message in messages:
        role = message.get("role", "?").upper()
        logger.info(f"[ai] --- {role} PROMPT ---\n{message.get('content', '')}")
    logger.info("=" * 72)

    started = time.perf_counter()
    try:
        content = chat(messages, images=images)
    except ModelCallError as exc:
        logger.error(f"[ai] FAILED after {time.perf_counter() - started:.2f}s: {exc}")
        raise ScriptGenerationError(str(exc)) from exc

    elapsed = time.perf_counter() - started
    logger.info(
        f"[ai] RESPONSE in {elapsed:.2f}s — {len(content)} chars, {len(content.split())} words"
    )
    logger.info(f"[ai] --- RAW RESPONSE ---\n{content}")
    logger.info("=" * 72)
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


def revise_script(
    script: str,
    instruction: str,
    title: str,
    audience: AudienceType,
    source_text: str | None = None,
    links: str | None = None,
    mood: ScriptMood | None = None,
    profession: Profession | None = None,
    experience_level: ExperienceLevel | None = None,
) -> str:
    """Apply a presenter instruction to an existing script. Returns the revised
    script.

    One whole-script call, matching the generation path. The version this
    replaced routed the instruction to individual beats and re-sent only those,
    which guaranteed untouched beats came back byte-for-byte — a guarantee this
    cannot make, because "change only what I asked" is a negative instruction
    with nothing behind it. Two things stand in for it: the prompt states an
    explicit word floor (see build_revision_prompt, unchanged), and the check
    below refuses a result that came back gutted.

    `source_text` is sent, unlike a beat in the old pipeline: "add the Q3
    numbers from my deck" is exactly the instruction that fails without the
    user's own material in context.
    """
    original_words = len(script.split())
    logger.info(
        f"[ai] revise_script: {original_words} words, audience={audience.value}, "
        f"source_text={'yes' if source_text else 'no'}"
    )
    logger.info(f"[ai] INSTRUCTION: {instruction}")

    revised = _call_model(
        build_revision_prompt(
            script=script,
            instruction=instruction,
            title=title,
            audience=audience,
            source_text=source_text,
            links=links,
            mood=mood,
            profession=profession,
            experience=experience_level,
        ),
        images=(),
    ).strip()

    revised_words = len(revised.split())
    if revised_words < MIN_REVISION_RETENTION * original_words:
        # Raised rather than silently returning the original: the task's failure
        # path restores the previous script *and* attaches a reason, so the user
        # is told their script is unchanged instead of quietly getting nothing.
        logger.warning(
            f"[ai] revision lost too much content ({original_words} -> "
            f"{revised_words} words), refusing it"
        )
        raise ScriptGenerationError(
            "The revision came back substantially shorter than the original, so it "
            "was discarded and your script is unchanged. Try a more specific instruction."
        )

    logger.info(f"[ai] REVISED: {original_words} -> {revised_words} words")
    return revised


def generate_script(
    description: str,
    duration_mins: int,
    audience: AudienceType,
    images: Sequence[ImageInput] = (),
    source_text: str | None = None,
    links: str | None = None,
    mood: ScriptMood | None = None,
    profession: Profession | None = None,
    experience_level: ExperienceLevel | None = None,
) -> tuple[str, str]:
    """Returns (title, script). One prompt in, one script out."""
    logger.info(
        f"[ai] generate_script: {duration_mins}min, audience={audience.value}, "
        f"images={len(images)}, source_text={'yes' if source_text else 'no'}, "
        f"links={'yes' if links else 'no'}"
    )
    logger.info(f"[ai] BRIEF: {description}")

    logger.info(
        f"[ai] VOICE: mood={mood.value if mood else '-'} "
        f"profession={profession.value if profession else '-'} "
        f"experience={experience_level.value if experience_level else '-'}"
    )

    messages = build_whole_script_prompt(
        description,
        duration_mins,
        audience,
        source_text=source_text,
        links=links,
        mood=mood,
        profession=profession,
        experience=experience_level,
    )
    raw = _call_model(messages, images)
    title, script = _split_title(raw, description)

    logger.info(f"[ai] TITLE : {title}")
    logger.info(f"[ai] SCRIPT: {len(script.split())} words")
    return title, script
