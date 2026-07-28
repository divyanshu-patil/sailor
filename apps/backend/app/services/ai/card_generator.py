import json
import logging
import re
import time

from app.services.ai.card_prompt import build_card_batch_prompt
from app.services.ai.chat import ModelCallError, chat, map_parallel
from app.utils.enums.speaking_style import SpeakingStyle

logger = logging.getLogger("celery")

# Maximum cards per AI call — the ceiling on batch size, not a fixed divisor: a
# deck smaller than this is one call.
#
# Raised from 6 after measuring, and the direction is the opposite of what the
# original "small batches are safer" reasoning assumed. Batches run
# concurrently, so wall time is the *slowest* batch — and per-call latency turns
# out to be dominated by fixed overhead, not by how many cards the call writes.
# One batch produced 2 cards in 34.6s while another produced 9 in 12.6s. More
# batches therefore means more draws from that slow tail, and the maximum gets
# worse. Same 26-card deck, same script, end to end:
#
#     7 batches (size 4)  -> 46.3s
#     5 batches (size 6)  -> 35.1s
#     3 batches (size 9)  -> 25.2s
#     2 batches (size 13) -> 17.5s
#
# 12 keeps a typical deck at two or three calls while bounding any single call's
# output, so one bad response can't take a large share of the deck with it. The
# per-batch retry and deterministic fill below cover it when one does.
CARD_BATCH_SIZE = 12

# Attempts per batch. Kept low because a retry is a whole extra model call on the
# critical path, and the deterministic fill below means a batch that still won't
# comply doesn't cost the user their deck.
MAX_BATCH_ATTEMPTS = 2

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


# Above this, the full script is condensed before being sent as calibration
# context. ~6000 characters is roughly a 10-minute talk — long enough that most
# scripts pass through untouched.
MAX_CALIBRATION_CHARS = 6000


def _script_digest(script: str) -> str:
    """
    A compact stand-in for the full script, for impact calibration.

    Every batch prompt carries the whole script so the model can judge how
    pivotal a segment is *relative to the talk*. On a long script that's several
    thousand tokens of prefill per batch, paid once per concurrent call, for
    context the model only needs the shape of. Keeping each section's header and
    opening sentence preserves that shape — what the beats are and roughly what
    each covers — at a fraction of the size. Short scripts are sent whole.
    """
    if len(script) <= MAX_CALIBRATION_CHARS:
        return script

    lines: list[str] = []
    for block in script.split("\n\n"):
        block = block.strip()
        if not block:
            continue
        if block.startswith("#"):
            lines.append(block)
            continue
        first = _SENTENCE_SPLIT_PATTERN.split(block)[0].strip()
        if first:
            lines.append(first)

    digest = "\n".join(lines)
    # A script with no headers to hang the digest off — a hand-written or
    # heavily edited one — degrades to a head-and-tail excerpt rather than to
    # nothing.
    if len(digest) > MAX_CALIBRATION_CHARS or not digest:
        half = MAX_CALIBRATION_CHARS // 2
        digest = f"{script[:half].strip()}\n\n[...]\n\n{script[-half:].strip()}"
    return digest


def _extract_json_array(text: str) -> str:
    start = text.find("[")
    end = text.rfind("]")
    if start == -1 or end == -1 or end < start:
        raise CardGenerationError("No JSON array found in model output")
    return text[start : end + 1]


DEFAULT_DELIVERY = SpeakingStyle.EXPLAINING.value
DEFAULT_IMPACT = 0.5
# Words used to build a stand-in title from a segment when the model gives none.
_STOPWORDS = {
    "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "at", "for",
    "with", "is", "are", "was", "were", "it", "its", "this", "that", "you",
    "your", "we", "our", "they", "their", "he", "she", "as", "so", "if", "then",
}


def _card_from_segment(segment: str) -> dict:
    """
    Deterministic card built from the segment's own words.

    The last resort when the model won't produce a usable card for a segment
    after retries. A plain card is a far better outcome than the alternative the
    old code took — one unusable item failed its batch, which failed the whole
    job, which discarded every other card in the deck and re-ran the lot. The
    presenter ends up with one flat card among thirty good ones instead of
    waiting minutes for nothing.
    """
    sentences = [s.strip() for s in _SENTENCE_SPLIT_PATTERN.split(segment.strip()) if s.strip()]
    first = sentences[0] if sentences else segment.strip()

    salient = [w.strip(".,;:!?\"'()") for w in first.split()]
    salient = [w for w in salient if len(w) > 3 and w.lower() not in _STOPWORDS]

    title = " ".join(salient[:4]) or " ".join(first.split()[:4]) or "Untitled Card"
    description = first if len(first) <= 160 else first[:157].rstrip() + "..."

    return {
        "title": title[:200],
        "description": description or "This part of the script.",
        "keywords": salient[:5],
        "impact": DEFAULT_IMPACT,
        "delivery": DEFAULT_DELIVERY,
    }


def _coerce_card(item, valid_delivery: set[str]) -> dict | None:
    """
    Turn one model-produced object into a valid card, or None if there's nothing
    usable in it.

    Every field except title/description is repaired rather than rejected. The
    model gets impact and delivery wrong often enough that treating either as
    fatal — which is what the previous version did — meant a single out-of-range
    number could cost the user their entire deck. Neither field is worth that:
    an impact that defaults to the middle of the range and a delivery that
    defaults to "explaining" are both perfectly serviceable.
    """
    if not isinstance(item, dict):
        return None

    title = str(item.get("title") or "").strip()
    description = str(item.get("description") or "").strip()
    # Content is the one thing that can't be invented from an empty object.
    if not title and not description:
        return None
    if not title:
        title = " ".join(description.split()[:4])
    if not description:
        description = title

    raw_keywords = item.get("keywords")
    if isinstance(raw_keywords, str):
        raw_keywords = [raw_keywords]
    keywords = (
        [str(k).strip() for k in raw_keywords if str(k).strip()][:10]
        if isinstance(raw_keywords, list)
        else []
    )

    try:
        impact = round(min(1.0, max(0.0, float(item.get("impact")))), 2)
    except (TypeError, ValueError):
        impact = DEFAULT_IMPACT

    delivery = str(item.get("delivery") or "").strip().lower().replace(" ", "_")
    if delivery not in valid_delivery:
        delivery = DEFAULT_DELIVERY

    return {
        "title": title[:200],
        "description": description,
        "keywords": keywords,
        "impact": impact,
        "delivery": delivery,
    }


def _coerce_cards(raw, valid_delivery: set[str]) -> list[dict]:
    """Best-effort read of a whole batch. Unusable entries are dropped, and the
    caller decides what to do about a short result."""
    if not isinstance(raw, list):
        raise CardGenerationError("Model output was not a JSON array")
    return [card for card in (_coerce_card(item, valid_delivery) for item in raw) if card]


def _generate_card_batch(
    full_script: str,
    segments: list[str],
    batch_start_index: int,
    total_segments: int,
    valid_delivery: set[str],
) -> list[dict]:
    messages = build_card_batch_prompt(
        full_script, segments, batch_start_index, total_segments, sorted(valid_delivery)
    )
    span = f"segments {batch_start_index}-{batch_start_index + len(segments) - 1}"
    expected = len(segments)
    best: list[dict] = []
    content = ""

    # Retried here, per batch, rather than by failing the whole job.
    #
    # This is the fix for card generation taking minutes and then failing. A
    # batch that came back with the wrong number of cards used to raise, which
    # failed generate_cards, which failed the task — and the task's retry re-ran
    # *every* batch from scratch, throwing away all the good ones. With thirty
    # cards that's five batches per attempt and four attempts, so one flaky
    # response cost twenty extra model calls and several minutes.
    for attempt in range(MAX_BATCH_ATTEMPTS):
        try:
            content = chat(messages)
            cards = _coerce_cards(json.loads(_extract_json_array(content)), valid_delivery)
        except ModelCallError as e:
            # Transport, not content — chat() has already tried every model.
            raise CardGenerationError(f"All models failed on {span}: {e}") from e
        except (CardGenerationError, json.JSONDecodeError) as e:
            logger.warning(f"[ai] unparseable card batch ({span}, attempt {attempt + 1}): {e}")
            cards = []

        if len(cards) > expected:
            # Over-production is harmless: the extras are for segments that
            # aren't in this batch, and they're in order, so trimming is correct.
            logger.info(f"[ai] card batch ({span}) returned {len(cards)}, trimming to {expected}")
            cards = cards[:expected]

        if len(cards) == expected:
            return cards

        if len(cards) > len(best):
            best = cards

        if attempt < MAX_BATCH_ATTEMPTS - 1:
            logger.warning(
                f"[ai] card batch ({span}) returned {len(cards)}/{expected}, retrying"
            )
            messages = messages + [
                {"role": "assistant", "content": content},
                {
                    "role": "user",
                    "content": (
                        f"That response contained {len(cards)} usable cards, but "
                        f"exactly {expected} are required — one per segment, in "
                        "the order given. Respond again with ONLY the raw JSON "
                        f"array of {expected} objects, each having title, "
                        "description, keywords, impact and delivery."
                    ),
                },
            ]

    # Still short. Fill the gap from the segments themselves rather than
    # discarding a batch of otherwise-good cards.
    logger.warning(
        f"[ai] card batch ({span}) settled at {len(best)}/{expected}; "
        "filling the remainder from segment text"
    )
    return best + [_card_from_segment(seg) for seg in segments[len(best) :]]


def generate_cards(script: str, card_count: int) -> list[dict]:
    """Public interface is unchanged — same signature, same return shape as
    before. card_tasks.py doesn't need to change at all; everything below is new,
    but nothing above this function's boundary needs to know that.

    Batches run concurrently. Each one is prompted with the full script plus its
    own segments, so no batch needs to see another's output — running them in
    sequence just multiplied the wait by the number of batches, which is what
    made a 20-card deck feel several times slower than a 6-card one."""
    valid_delivery = {style.value for style in SpeakingStyle}
    segments = split_script_into_segments(script, card_count)

    batch_starts = list(range(0, card_count, CARD_BATCH_SIZE))
    calibration = _script_digest(script)
    if calibration is not script:
        logger.info(
            f"[ai] calibration context condensed {len(script)} -> {len(calibration)} chars"
        )

    def run_batch(batch_start: int) -> list[dict]:
        started = time.monotonic()
        cards = _generate_card_batch(
            full_script=calibration,
            segments=segments[batch_start : batch_start + CARD_BATCH_SIZE],
            batch_start_index=batch_start + 1,  # 1-indexed for prompts/logs
            total_segments=card_count,
            valid_delivery=valid_delivery,
        )
        logger.info(
            f"[ai] card batch at {batch_start + 1} produced {len(cards)} cards "
            f"in {time.monotonic() - started:.1f}s"
        )
        return cards

    started = time.monotonic()
    # Order matters — a card's position in the deck is its position in the
    # script — and map_parallel returns results in the order they were submitted,
    # not the order they finished.
    cards = [card for batch in map_parallel(run_batch, batch_starts) for card in batch]
    logger.info(
        f"[ai] {len(cards)} cards across {len(batch_starts)} batches "
        f"in {time.monotonic() - started:.1f}s total"
    )
    return cards