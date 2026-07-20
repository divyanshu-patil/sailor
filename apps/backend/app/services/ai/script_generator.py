import json
import logging
import re

from ollama import ResponseError

from app.config.settings import settings
from app.services.ai.ollama_client import get_ollama_client
from app.services.ai.prompts import (
    build_continuation_message,
    build_delist_prompt,
    build_outline_prompt,
    build_section_prompt,
    section_count_for_duration,
    word_budget,
)
from app.utils.enums.deck_enums import AudienceType

logger = logging.getLogger("celery")

LIST_LINE_PATTERN = re.compile(r"^[ \t]*(\d+[.)]|[-*])[ \t]+", re.MULTILINE)
MIN_ACCEPTABLE_RATIO = 0.9  # a section within 90% of its target word count is accepted as-is
MAX_CONTINUATION_ATTEMPTS = 2
MAX_DELIST_ATTEMPTS = 1
MAX_OUTLINE_ATTEMPTS = 2


class ScriptGenerationError(Exception):
    """Raised when no configured model could produce a script."""


def _models_to_try() -> list[str]:
    return [m for m in (settings.OLLAMA_MODEL, settings.OLLAMA_FALLBACK_MODEL) if m]


def _chat_with_fallback(client, messages: list[dict]) -> str:
    """Try each configured model in order for a single call, same fallback
    behavior as before — just reusable per pipeline step instead of once for
    the whole script."""
    last_error: Exception | None = None
    for model in _models_to_try():
        try:
            response = client.chat(model=model, messages=messages, stream=False)
            content = (response.get("message", {}) or {}).get("content", "").strip()
            if content:
                return content
            raise ScriptGenerationError(f"Model '{model}' returned empty content")
        except ResponseError as e:
            logger.warning(f"[ai] '{model}' failed ({e.status_code}): {e.error}")
            last_error = e
        except Exception as e:  # network errors, timeouts, etc.
            logger.warning(f"[ai] '{model}' failed: {e}")
            last_error = e
    raise ScriptGenerationError(f"All models failed. Last error: {last_error}")


def _strip_json_fences(raw: str) -> str:
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text
        if text.endswith("```"):
            text = text.rsplit("```", 1)[0]
    return text.strip()


def _fallback_outline(duration_mins: int) -> dict:
    """Deterministic outline used only if the model can't produce valid JSON
    after retries — keeps the job alive instead of failing over a parse error.
    Note: Ollama Cloud does not currently support schema-constrained structured
    outputs, so we can't force valid JSON at the decoding level and have to
    handle malformed responses defensively here."""
    n_sections = section_count_for_duration(duration_mins)
    _, _, body_words = word_budget(duration_mins)
    per_section = max(150, body_words // n_sections)
    return {
        "sections": [
            {"title": f"Key point {i + 1}", "target_words": per_section, "key_points": []}
            for i in range(n_sections)
        ]
    }


def _normalize_outline(outline: dict, duration_mins: int) -> dict:
    """Rescale section word targets so they actually sum to the body budget —
    don't trust the model's arithmetic, verify and correct it."""
    _, _, body_words = word_budget(duration_mins)
    sections = outline.get("sections") or []
    total = sum(int(s.get("target_words") or 0) for s in sections) or 1
    for s in sections:
        s["target_words"] = max(150, round(int(s.get("target_words") or 0) * body_words / total))
    outline["sections"] = sections
    return outline


def _generate_outline(client, title, description, duration_mins, audience) -> dict:
    messages = build_outline_prompt(title, description, duration_mins, audience)
    for attempt in range(MAX_OUTLINE_ATTEMPTS):
        try:
            raw = _chat_with_fallback(client, messages)
            outline = json.loads(_strip_json_fences(raw))
            if isinstance(outline, dict) and outline.get("sections"):
                return _normalize_outline(outline, duration_mins)
            raise ValueError("missing 'sections' key")
        except (json.JSONDecodeError, ValueError, ScriptGenerationError) as e:
            logger.warning(f"[ai] outline attempt {attempt} failed: {e}")
            messages.append(
                {
                    "role": "user",
                    "content": (
                        "That was not valid JSON matching the required shape. "
                        "Respond again with ONLY the JSON object, nothing else."
                    ),
                }
            )
    logger.warning("[ai] outline generation failed after retries, using deterministic fallback outline")
    return _fallback_outline(duration_mins)


def _generate_section(
    client, *, kind: str, heading: str, key_points, target_words: int, title: str,
    audience: AudienceType, include_question: bool,
) -> str:
    messages = build_section_prompt(
        kind=kind,
        heading=heading,
        key_points=key_points,
        target_words=target_words,
        title=title,
        audience=audience,
        include_question=include_question,
    )
    text = _chat_with_fallback(client, messages)

    # Undershoot repair: ask the model to continue rather than regenerating from
    # scratch, since LLMs can't reliably self-report word count mid-generation.
    for _ in range(MAX_CONTINUATION_ATTEMPTS):
        current_words = len(text.split())
        if current_words >= MIN_ACCEPTABLE_RATIO * target_words:
            break
        messages.append({"role": "assistant", "content": text})
        messages.append(build_continuation_message(target_words - current_words))
        text = text + "\n\n" + _chat_with_fallback(client, messages)

    # Format repair: catch banned list formatting deterministically rather than
    # trusting the negative instruction to hold.
    for _ in range(MAX_DELIST_ATTEMPTS):
        if not LIST_LINE_PATTERN.search(text):
            break
        logger.warning(f"[ai] list formatting detected in '{heading}', running delist repair")
        text = _chat_with_fallback(client, build_delist_prompt(text))

    return text


def generate_script(title: str, description: str | None, duration_mins: int, audience: AudienceType) -> str:
    client = get_ollama_client()

    outline = _generate_outline(client, title, description, duration_mins, audience)
    opening_words, closing_words, _ = word_budget(duration_mins)
    sections = outline["sections"]

    parts = [
        _generate_section(
            client, kind="opening", heading="Opening", key_points=None,
            target_words=opening_words, title=title, audience=audience, include_question=False,
        )
    ]

    for i, section in enumerate(sections):
        parts.append(
            _generate_section(
                client,
                kind="body",
                heading=section["title"],
                key_points=section.get("key_points"),
                target_words=section["target_words"],
                title=title,
                audience=audience,
                include_question=(i == len(sections) // 2),  # roughly one, placed mid-script
            )
        )

    parts.append(
        _generate_section(
            client, kind="closing", heading="Close", key_points=None,
            target_words=closing_words, title=title, audience=audience, include_question=False,
        )
    )

    script = "\n\n".join(parts)

    total_words = len(script.split())
    target_words = duration_mins * 140
    logger.info(f"[ai] script generated: {total_words} words (target ~{target_words})")

    return script