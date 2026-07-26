import json
import logging
import re

from ollama import ResponseError

from app.config.settings import settings
from app.services.ai.card_prompt import build_card_batch_prompt
from app.services.ai.ollama_client import get_ollama_client
from app.utils.enums.speaking_style import SpeakingStyle

logger = logging.getLogger("celery")

# Cards generated per AI call — NOT card_count. Keeping this fixed and small is
# the actual fix: each call's output stays short and grounded no matter how large
# the overall card_count gets, which is what prevents truncation and drift at
# high counts. Tune this if you see batches still struggling — smaller is safer,
# larger means fewer total Ollama calls (matters for free-tier rate limits).
CARD_BATCH_SIZE = 6

_SENTENCE_SPLIT_PATTERN = re.compile(r"(?<=[.!?])\s+")


class CardGenerationError(Exception):
    """Raised when no configured model could produce a valid set of cards, or
    when the request itself is unsatisfiable (e.g. more cards requested than
    the script has sentences to divide)."""


def split_script_into_segments(script: str, card_count: int) -> list[str]:
    """Deterministically divides the script into `card_count` sentence-respecting
    segments covering it end-to-end, with no gaps or overlaps. This used to be
    something we asked the AI to do as part of a single giant call — moving it to
    plain code removes the single biggest source of drift at high card counts:
    the model no longer has to simultaneously segment a long script AND write
    rich content for every segment in one shot; it only ever does the second
    part, a batch at a time."""
    sentences = [s.strip() for s in _SENTENCE_SPLIT_PATTERN.split(script.strip()) if s.strip()]

    if card_count > len(sentences):
        raise CardGenerationError(
            f"Requested {card_count} cards, but the script only has {len(sentences)} "
            f"sentences to divide — reduce the card count."
        )

    total_words = sum(len(s.split()) for s in sentences)
    target_words_per_segment = max(1, total_words / card_count)

    segments: list[list[str]] = [[] for _ in range(card_count)]
    seg_index = 0
    seg_word_count = 0

    for sentence in sentences:
        segments[seg_index].append(sentence)
        seg_word_count += len(sentence.split())
        # Advance once this segment has roughly hit its share of the script —
        # but never past the last segment, so any remainder from uneven
        # sentence lengths lands in the final card instead of being dropped.
        if seg_word_count >= target_words_per_segment and seg_index < card_count - 1:
            seg_index += 1
            seg_word_count = 0

    return [" ".join(seg).strip() for seg in segments]


def _extract_json_array(text: str) -> str:
    start = text.find("[")
    end = text.rfind("]")
    if start == -1 or end == -1 or end < start:
        raise CardGenerationError("No JSON array found in model output")
    return text[start : end + 1]


def _validate_cards(raw: list, expected_count: int, valid_delivery: set[str]) -> list[dict]:
    if not isinstance(raw, list):
        raise CardGenerationError("Model output was not a JSON array")
    if len(raw) != expected_count:
        raise CardGenerationError(f"Expected {expected_count} cards, got {len(raw)}")

    cleaned = []
    for i, item in enumerate(raw):
        if not isinstance(item, dict):
            raise CardGenerationError(f"Card {i} is not a JSON object")

        missing = {"title", "description", "keywords", "impact", "delivery"} - item.keys()
        if missing:
            raise CardGenerationError(f"Card {i} missing fields: {missing}")

        title = str(item["title"]).strip()
        description = str(item["description"]).strip()
        keywords = item["keywords"]
        if not title or not description:
            raise CardGenerationError(f"Card {i} has an empty title or description")
        if not isinstance(keywords, list) or not all(isinstance(k, str) for k in keywords):
            raise CardGenerationError(f"Card {i} keywords must be a list of strings")

        try:
            impact = float(item["impact"])
        except (TypeError, ValueError):
            raise CardGenerationError(f"Card {i} impact is not a number")
        if not (0.0 <= impact <= 1.0):
            raise CardGenerationError(f"Card {i} impact {impact} out of range 0.00-1.00")

        delivery = str(item["delivery"]).strip()
        if delivery not in valid_delivery:
            raise CardGenerationError(f"Card {i} delivery '{delivery}' is not a valid SpeakingStyle")

        cleaned.append(
            {
                "title": title[:200],
                "description": description,
                "keywords": [k.strip() for k in keywords if k.strip()][:10],
                "impact": round(impact, 2),
                "delivery": delivery,
            }
        )

    return cleaned


def _generate_card_batch(
    full_script: str,
    segments: list[str],
    batch_start_index: int,
    total_segments: int,
    valid_delivery: set[str],
) -> list[dict]:
    client = get_ollama_client()
    messages = build_card_batch_prompt(
        full_script, segments, batch_start_index, total_segments, sorted(valid_delivery)
    )

    models_to_try = [m for m in (settings.OLLAMA_MODEL, settings.OLLAMA_FALLBACK_MODEL) if m]
    last_error: Exception | None = None

    for model in models_to_try:
        try:
            response = client.chat(model=model, messages=messages, stream=False)
            content = (response.get("message", {}) or {}).get("content", "").strip()
            if not content:
                raise CardGenerationError(f"Model '{model}' returned empty content")

            raw_cards = json.loads(_extract_json_array(content))
            return _validate_cards(raw_cards, len(segments), valid_delivery)

        except (ResponseError, CardGenerationError, json.JSONDecodeError) as e:
            logger.warning(
                f"[ai] '{model}' failed batch (segments {batch_start_index}-"
                f"{batch_start_index + len(segments) - 1}): {e}"
            )
            last_error = e
        except Exception as e:
            logger.warning(
                f"[ai] '{model}' failed batch (segments {batch_start_index}-"
                f"{batch_start_index + len(segments) - 1}): {e}"
            )
            last_error = e

    raise CardGenerationError(
        f"All models failed on segments {batch_start_index}-"
        f"{batch_start_index + len(segments) - 1}. Last error: {last_error}"
    )


def generate_cards(script: str, card_count: int) -> list[dict]:
    """Public interface is unchanged — same signature, same return shape as
    before. card_tasks.py doesn't need to change at all; everything below is new,
    but nothing above this function's boundary needs to know that."""
    valid_delivery = {style.value for style in SpeakingStyle}
    segments = split_script_into_segments(script, card_count)

    all_cards: list[dict] = []
    for batch_start in range(0, card_count, CARD_BATCH_SIZE):
        batch_segments = segments[batch_start : batch_start + CARD_BATCH_SIZE]
        batch_cards = _generate_card_batch(
            full_script=script,
            segments=batch_segments,
            batch_start_index=batch_start + 1,  # 1-indexed for prompts/logs
            total_segments=card_count,
            valid_delivery=valid_delivery,
        )
        all_cards.extend(batch_cards)

    return all_cards