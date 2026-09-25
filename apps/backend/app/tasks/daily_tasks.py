import json
import logging
import random
import re
from datetime import date, timedelta

from celery.signals import worker_ready
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.celery_app import celery_app
from app.db.database import SessionLocal
from app.models.daily_model import DailyContent
from app.services.ai.chat import ModelCallError, chat, map_parallel
from app.services.daily.frameworks import FRAMEWORKS, Framework
from app.utils.enums.user_enums import ScriptMood

logger = logging.getLogger("celery")

# How far ahead the buffer runs. A week is enough that a day of failed model
# calls — or a worker that was down overnight — never reaches a user, and short
# enough that a change to the prompt shows up within the week.
BUFFER_DAYS = 7

# Variations per day. The whole point is that two users don't get identical text;
# past a handful that stops improving and just costs tokens.
VARIATIONS_PER_DAY = 5

# Hard ceiling on body length, enforced after generation as well as asked for in
# the prompt.
#
# A framework with four or more steps invites one sentence per step, which is how
# the first real run came back: every PREP variation was four sentences, one each
# for Point / Reason / Example / Point. That is a longer read than "ten seconds"
# allows, and it is not what the worked examples do — the PREP example lands all
# four steps in three sentences by letting Reason and Example share one.
MAX_BODY_SENTENCES = 3

_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")


def count_sentences(body: str) -> int:
    return len([part for part in _SENTENCE_SPLIT.split(body.strip()) if part])

# No framework may repeat inside this window.
#
# Enforced by construction rather than by a query: `framework_for` walks the
# library in a fixed cycle, so the gap between two uses of the same framework is
# always exactly len(FRAMEWORKS) days. The assertion below is what keeps that
# true if the library is ever trimmed — it is a seed set meant to grow, but
# shrinking it under the cooldown would silently break the guarantee.
FRAMEWORK_COOLDOWN_DAYS = 14
assert len(FRAMEWORKS) > FRAMEWORK_COOLDOWN_DAYS, (
    f"The framework rotation repeats every {len(FRAMEWORKS)} days, which is inside the "
    f"{FRAMEWORK_COOLDOWN_DAYS}-day cooldown. Add frameworks or lower the cooldown."
)


def framework_for(day: date) -> Framework:
    """The day's framework — a computed rotation, not a stored queue.

    Walking the library in order gives both properties the spec asks for, for
    free: every framework is used exactly as often as every other, and the same
    one cannot recur inside len(FRAMEWORKS) days, which is well past the
    cooldown. A stored queue would add a table, a race between the beat and the
    startup kick, and a way for regeneration to hand the same date a different
    framework than it had before.

    Adding a framework shifts which one future dates land on. Days already
    generated are persisted, so nothing a user has seen changes.
    """
    return FRAMEWORKS[day.toordinal() % len(FRAMEWORKS)]


def situation_for(day: date, framework: Framework):
    """Picked from this framework's own `best_for`, never the full enum.

    Integer-dividing by the library length advances this one step each time the
    framework comes back around, so a framework with three situations cycles
    through all three across its appearances instead of always drawing the first.
    """
    cycle = day.toordinal() // len(FRAMEWORKS)
    return framework.best_for[cycle % len(framework.best_for)]


def mood_for(day: date) -> ScriptMood:
    """One mood for the whole day, seeded by the date.

    Seeded rather than random so re-running a day's generation — a retry, an
    admin regeneration — produces the same tone it had before.
    """
    moods = list(ScriptMood)
    return moods[random.Random(day.toordinal()).randrange(len(moods))]


_SYSTEM_PROMPT = """You are generating short daily public-speaking practice content for the Sailors app.

For the given day you are told:
- framework: the exact named framework to use — do not invent a new one or blend two
- situation: the real-world scenario to apply it to
- mood: the emotional tone

Generate {count} variations. Each variation must contain:
- title: 2-5 words naming what this specific snippet is ABOUT — the topic, not
  the framework. "Pitching a slower rollout", not "PREP". Title case, no quotes,
  no trailing punctuation.
- body: 2-3 sentences that CONCRETELY APPLY the framework's steps to the given
  situation — written as if someone is actually delivering that moment of a
  speech, not describing the framework. Never write a sentence like "This
  technique helps you structure your point" — that is exactly the generic filler
  this system exists to avoid. Every sentence must be something a person could
  actually say out loud in the scenario.
- tip: one sentence, naming the framework, giving a single concrete cue for
  delivering it live (a pacing note, a word to avoid, a place to pause) — not a
  restatement of what the framework is.

Hard rules:
1. Follow the framework's step order exactly: {steps}. No step skipped, no reordering.
2. Ground every variation in a specific, concrete detail (a number, a name, a
   specific object or moment) — never a vague generalization.
3. Match the requested mood in word choice and sentence rhythm, not by stating the mood.
4. Keep body to 2-3 sentences TOTAL. Not 2-3 sentences per step — 2-3 for the
   whole body. Steps share sentences: a framework with five steps still gets
   three sentences, so compress several steps into one where they read naturally.
   Writing one sentence per step is the single most common way to get this wrong.
5. The {count} variations must be different concrete scenarios within the same
   situation tag — not just reworded versions of the same sentence.

Here is a correct application of {framework_name}, for calibration:
  body: {example_body}
  tip: {example_tip}

Output ONLY a JSON array of exactly {count} objects, no prose and no code fence:
[{{"title": "...", "body": "...", "tip": "..."}}]
"""

_USER_PROMPT = """framework: {framework_name}
steps: {steps}
situation: {situation}
mood: {mood}

Write {count} variations."""


def _extract_json_array(text: str) -> str:
    start, end = text.find("["), text.rfind("]")
    if start == -1 or end == -1 or end < start:
        raise ValueError("No JSON array in model output")
    return text[start : end + 1]


def generate_day(day: date) -> list[dict]:
    """One model call for the whole day.

    All of a day's variations share the framework, situation and mood — they
    differ by the concrete scenario the framework is applied to. That is what
    the few-shot in the system prompt is calibrating: the difference between
    applying a framework and describing one.
    """
    framework = framework_for(day)
    situation = situation_for(day, framework)
    mood = mood_for(day)
    steps = " → ".join(framework.steps)

    system = _SYSTEM_PROMPT.format(
        count=VARIATIONS_PER_DAY,
        steps=steps,
        framework_name=framework.name,
        example_body=framework.example_body,
        example_tip=framework.example_tip,
    )
    user = _USER_PROMPT.format(
        framework_name=framework.name,
        steps=steps,
        situation=situation.value,
        mood=mood.value,
        count=VARIATIONS_PER_DAY,
    )

    content = chat([{"role": "system", "content": system}, {"role": "user", "content": user}])
    items = json.loads(_extract_json_array(content))
    if not isinstance(items, list):  # pragma: no cover — the extractor only returns [...]
        raise ValueError("Model output was not a list")

    units: list[dict] = []
    oversized: list[tuple[str, str]] = []
    for index, item in enumerate(items[:VARIATIONS_PER_DAY]):
        if not isinstance(item, dict):
            continue
        body = str(item.get("body", "")).strip()
        tip = str(item.get("tip", "")).strip()
        # Falls back to the framework's own name rather than dropping the
        # variation: a missing title costs a nicer heading, not the practice.
        title = str(item.get("title", "")).strip()[:120] or framework.short_name
        if not body or not tip:
            # Skip rather than substitute: a day with four good variations is
            # fine (the hash just picks from four), a day with a placeholder
            # paragraph in it is not.
            logger.warning(f"[daily] dropping empty variation {index} for {day}")
            continue
        if count_sentences(body) > MAX_BODY_SENTENCES:
            # Held back rather than dropped outright. Collected so that a day
            # where the model ran long on *every* variation still ships content
            # — see the fallback below — rather than going blank and serving a
            # 503 over a style rule.
            oversized.append((body, tip))
            continue
        units.append(
            {
                "date": day,
                "framework": framework.id,
                "title": title,
                "mood": mood.value,
                "situation": situation.value,
                "body": body,
                "tip": tip,
                "variation_index": len(units),
            }
        )

    if not units and oversized:
        # Every variation ran long. Take the shortest two rather than leave the
        # day empty: slightly wordy practice content beats no practice content,
        # and the next refill regenerates the day anyway.
        logger.warning(
            f"[daily] every variation for {day} exceeded {MAX_BODY_SENTENCES} sentences — "
            f"keeping the {min(2, len(oversized))} shortest"
        )
        for body, tip in sorted(oversized, key=lambda pair: count_sentences(pair[0]))[:2]:
            units.append(
                {
                    "date": day,
                    "framework": framework.id,
                    "title": framework.short_name,
                    "mood": mood.value,
                    "situation": situation.value,
                    "body": body,
                    "tip": tip,
                    "variation_index": len(units),
                }
            )
    elif oversized:
        logger.info(
            f"[daily] dropped {len(oversized)} over-long variation(s) for {day}, "
            f"{len(units)} kept"
        )

    return units


@celery_app.task
def refill_daily_content(
    days: int = BUFFER_DAYS,
    force: bool = False,
    override_today: bool = False,
) -> int:
    """Top the buffer up to `days` ahead. Returns the number of days filled.

    Idempotent by design — it only generates days that have no rows at all, so
    running it hourly costs one cheap query on a full buffer, and a day that
    failed yesterday is simply picked up on the next beat. That's why it runs
    often rather than once at midnight: a once-a-day job that fails has to wait
    a day to try again, and the buffer is the only thing standing between a
    model outage and an empty screen.

    `force` discards and regenerates days that already exist — the admin
    regeneration route's whole purpose, for when the prompt or the library
    changed and the buffered content is stale rather than missing.

    Today is protected from `force` unless `override_today` is also set. A
    regeneration is usually run because the *next* few days are wrong, and
    silently rewriting the day people are already practising swaps the snippet
    out from under anyone mid-session — their line count changes, the streak
    screen's numbers stop matching what they read. Today is still generated by
    `force` when it has no content at all; the protection is against replacing
    content, not against filling a hole.
    """
    db = SessionLocal()
    try:
        today = date.today()
        wanted = [today + timedelta(days=offset) for offset in range(max(1, days))]

        existing = set(
            db.execute(
                select(DailyContent.date).where(DailyContent.date.in_(wanted)).distinct()
            )
            .scalars()
            .all()
        )

        if force:
            # Everything in range is regenerated, but nothing is deleted yet —
            # see the swap below. Today is held back when it already has content
            # and the caller didn't explicitly ask to override it.
            targets = [
                day
                for day in wanted
                if override_today or day != today or day not in existing
            ]
            if not override_today and today in existing:
                logger.info(
                    "[daily] force regeneration is leaving today alone "
                    "(pass override_today to replace it)"
                )
        else:
            targets = [day for day in wanted if day not in existing]

        if not targets:
            return 0

        logger.info(f"[daily] generating {len(targets)} day(s): {targets[0]}..{targets[-1]}")

        def safe_generate(day: date) -> list[dict]:
            try:
                return generate_day(day)
            except (ModelCallError, ValueError, json.JSONDecodeError) as e:
                # One bad day must not take the rest of the refill with it — the
                # next beat retries it, and there are days of buffer to absorb it.
                logger.warning(f"[daily] generation failed for {day}: {e}")
                return []

        filled = 0
        for day, units in zip(targets, map_parallel(safe_generate, targets)):
            if not units:
                # Generation failed for this day. Under `force` that means the
                # existing content stays exactly where it is — see below.
                continue

            # Generate first, delete second, in one transaction per day.
            #
            # `force` used to clear the whole range up front and regenerate
            # afterwards. That left a window — a minute of model calls wide —
            # where today's content did not exist and every user got a 503, and
            # if generation then failed the hole was permanent until the next
            # beat. Ordering it this way means content is only ever replaced by
            # content: a failed day keeps what it had, and a successful one
            # swaps atomically.
            #
            # Committed per day rather than once at the end for a second reason:
            # two runs can overlap (the startup kick alongside the beat, or a
            # slow refill still going when the next hour fires) and would both
            # see the same day as missing. Per-day commits mean the loser of
            # that race hits the (date, variation_index) unique constraint on
            # its own day and skips it, instead of rolling back every good day
            # generated alongside it.
            try:
                if force:
                    db.query(DailyContent).filter(DailyContent.date == day).delete(
                        synchronize_session=False
                    )
                db.add_all(DailyContent(**unit) for unit in units)
                db.commit()
                filled += 1
            except IntegrityError:
                db.rollback()
                logger.info(f"[daily] {day} was already filled by a concurrent run")

        return filled
    finally:
        db.close()


@worker_ready.connect
def _fill_buffer_on_startup(**_kwargs) -> None:
    """Fill the buffer as soon as a worker comes up.

    Without this the beat is the only trigger, so a database with no content —
    a fresh install, a new dev environment, a restored dump — serves 503 from
    `/daily-practice/today` until the next HH:09 UTC. That is up to an hour of
    the feature being simply broken, and it is the first hour anyone new spends
    with it.

    The task only generates days that are missing, so on a warm database this
    costs one query per worker start.
    """
    refill_daily_content.delay()
