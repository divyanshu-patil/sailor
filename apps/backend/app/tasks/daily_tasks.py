import json
import logging
import random
from datetime import date, timedelta

from sqlalchemy import select

from app.core.celery_app import celery_app
from app.db.database import SessionLocal
from app.models.daily_model import DailyContent, DailyContentType
from app.services.ai.chat import ModelCallError, chat, map_parallel
from app.utils.enums.deck_enums import DeckCategory
from app.utils.enums.user_enums import ScriptMood

logger = logging.getLogger("celery")

# How far ahead the buffer runs. A week is enough that a day of failed model
# calls — or a worker that was down overnight — never reaches a user, and short
# enough that a change to the prompt shows up within the week.
BUFFER_DAYS = 7

# Variations per day. The whole point is that two users don't get identical text;
# past a handful that stops improving and just costs tokens.
VARIATIONS_PER_DAY = 5

_TYPE_CYCLE = list(DailyContentType)


def type_for(day: date) -> DailyContentType:
    """The day's theme, from the date alone.

    Deliberately shared by every user: it makes the label on the screen a real
    statement about today, it means the six types actually rotate instead of
    drifting per account, and it keeps the day's content to one generation for
    the whole user base. Personalisation lives in the variation, not the theme.
    """
    return _TYPE_CYCLE[day.toordinal() % len(_TYPE_CYCLE)]


_PROMPT = """You write daily micro-practice for a presentation-rehearsal app.

Today's theme: {theme}

Produce exactly {count} DIFFERENT practice snippets. Each one is something the
user reads aloud once, in under fifteen seconds — not a script, not advice
dressed up as a script.

Each snippet must:
- be 2-3 sentences of speakable prose, first person, ready to say out loud
- be written in the given mood, for the given situation
- stand alone: no "as I mentioned", no references to slides or a longer talk
- come with one short actionable delivery tip (one line, under 15 words)

Return ONLY a JSON array of exactly {count} objects, no prose, no code fence:
[{{"mood": "...", "situation": "...", "body": "...", "tip": "..."}}]

Use these mood/situation pairs, in this order:
{pairs}
"""


def _extract_json_array(text: str) -> str:
    start, end = text.find("["), text.rfind("]")
    if start == -1 or end == -1 or end < start:
        raise ValueError("No JSON array in model output")
    return text[start : end + 1]


def _pairs_for(day: date, count: int) -> list[tuple[str, str]]:
    """Mood/situation pairs for the day, drawn deterministically from the date.

    Seeded rather than random so re-running a day's generation (a retry, a
    backfill) produces the same spread, and so the six themes don't all land on
    "confident / investor_pitch" the way an unseeded shuffle eventually does.
    """
    rng = random.Random(day.toordinal())
    moods = [m.value for m in ScriptMood]
    situations = [c.value for c in DeckCategory if c is not DeckCategory.OTHER]
    return [(rng.choice(moods), rng.choice(situations)) for _ in range(count)]


def generate_day(day: date) -> list[dict]:
    """One model call for the whole day. Variations differ by the mood/situation
    they're written to, which is what stops five "write something different"
    requests coming back as five paraphrases of each other."""
    theme = type_for(day)
    pairs = _pairs_for(day, VARIATIONS_PER_DAY)
    prompt = _PROMPT.format(
        theme=theme.value.replace("_", " "),
        count=VARIATIONS_PER_DAY,
        pairs="\n".join(f"{i}. mood={m}, situation={s}" for i, (m, s) in enumerate(pairs)),
    )

    content = chat([{"role": "user", "content": prompt}])
    items = json.loads(_extract_json_array(content))
    if not isinstance(items, list):
        raise ValueError("Model output was not a list")

    units: list[dict] = []
    for index, item in enumerate(items[:VARIATIONS_PER_DAY]):
        body = str(item.get("body", "")).strip()
        tip = str(item.get("tip", "")).strip()
        if not body or not tip:
            # Skip rather than substitute: a day with four good variations is
            # fine (the hash just picks from four), a day with a placeholder
            # paragraph in it is not.
            logger.warning(f"[daily] dropping empty variation {index} for {day}")
            continue
        fallback_mood, fallback_situation = pairs[index]
        units.append(
            {
                "date": day,
                "type": theme.value,
                "mood": str(item.get("mood") or fallback_mood),
                "situation": str(item.get("situation") or fallback_situation),
                "body": body,
                "tip": tip,
                "variation_index": len(units),
            }
        )
    return units


@celery_app.task
def refill_daily_content() -> int:
    """Top the buffer up to BUFFER_DAYS ahead. Returns the number of days filled.

    Idempotent by design — it only generates days that have no rows at all, so
    running it hourly costs one cheap query on a full buffer, and a day that
    failed yesterday is simply picked up on the next beat. That's why it runs
    often rather than once at midnight: a once-a-day job that fails has to wait
    a day to try again, and the buffer is the only thing standing between a
    model outage and an empty screen.
    """
    db = SessionLocal()
    try:
        today = date.today()
        wanted = [today + timedelta(days=offset) for offset in range(BUFFER_DAYS)]

        existing = set(
            db.execute(
                select(DailyContent.date).where(DailyContent.date.in_(wanted)).distinct()
            )
            .scalars()
            .all()
        )
        missing = [day for day in wanted if day not in existing]
        if not missing:
            return 0

        logger.info(f"[daily] generating {len(missing)} day(s): {missing[0]}..{missing[-1]}")

        def safe_generate(day: date) -> list[dict]:
            try:
                return generate_day(day)
            except (ModelCallError, ValueError, json.JSONDecodeError) as e:
                # One bad day must not take the rest of the refill with it — the
                # next beat retries it, and there are days of buffer to absorb it.
                logger.warning(f"[daily] generation failed for {day}: {e}")
                return []

        filled = 0
        for units in map_parallel(safe_generate, missing):
            if not units:
                continue
            db.add_all(DailyContent(**unit) for unit in units)
            filled += 1

        db.commit()
        return filled
    finally:
        db.close()
