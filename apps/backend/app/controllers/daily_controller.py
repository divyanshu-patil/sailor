import hashlib
from datetime import date, timedelta

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.daily_model import DailyContent
from app.services.daily.frameworks import FRAMEWORK_LABELS, FRAMEWORKS_BY_ID
from app.utils.enums.daily_enums import SITUATION_LABELS
from app.models.user_model import User
from app.schemas.daily_schema import (
    DailyContentUnitResponse,
    DailyTodayResponse,
    StreakResponse,
)

#: Restores allowed per calendar month. One: the point of a streak is that
#: missing a day costs something, and an uncapped undo removes the cost.
RESTORES_PER_MONTH = 1


def select_variation(user_key: str, day: date, count: int) -> int:
    """Which of the day's variations this user gets.

    A hash of (user, date) rather than a random draw or a stored choice: the app
    and the widget both resolve the same unit from the same two facts, so there
    is nothing to keep in sync between them and no "chosen variation" row to
    write on first view. Stable for the whole day, different tomorrow, and
    different for the user sitting next to you.

    `user_key` is `User.public_id` — the random hex, never the integer primary
    key. The integer is 1, 2, 3, 4 in signup order, so hashing it makes each
    user's whole schedule of variations derivable from their position in the
    signup queue.
    """
    if count <= 0:
        raise ValueError("count must be positive")
    digest = hashlib.sha256(f"{user_key}:{day.isoformat()}".encode()).hexdigest()
    return int(digest[:8], 16) % count


def _to_response(unit: DailyContent) -> DailyContentUnitResponse:
    framework = FRAMEWORKS_BY_ID.get(unit.framework)
    return DailyContentUnitResponse(
        id=str(unit.id),
        date=unit.date,
        title=unit.title or FRAMEWORK_LABELS.get(unit.framework, unit.framework),
        framework=unit.framework,
        # Falls back to the raw id, so content generated under a framework that
        # was later renamed or removed still renders something sensible.
        frameworkLabel=FRAMEWORK_LABELS.get(unit.framework, unit.framework),
        frameworkSteps=list(framework.steps) if framework else [],
        frameworkDescription=framework.description if framework else "",
        frameworkStepHints=list(framework.step_hints) if framework else [],
        frameworkBestFor=(
            [SITUATION_LABELS[tag] for tag in framework.best_for] if framework else []
        ),
        frameworkIcon=framework.icon if framework else "book-open",
        mood=unit.mood,
        situation=unit.situation,
        body=unit.body,
        tip=unit.tip,
        variationIndex=unit.variation_index,
    )


def _unit_for(db: Session, user_key: str, day: date) -> DailyContent | None:
    variations = (
        db.execute(
            select(DailyContent)
            .where(DailyContent.date == day)
            .order_by(DailyContent.variation_index)
        )
        .scalars()
        .all()
    )
    if not variations:
        return None
    return variations[select_variation(user_key, day, len(variations))]


def get_today(db: Session, user_key: str, local_date: date) -> DailyTodayResponse:
    today = _unit_for(db, user_key, local_date)
    if today is None:
        # The buffer ran dry — a generation failure, not a user error. 503 so the
        # client shows its cached unit and retries later rather than treating the
        # day as legitimately empty.
        raise HTTPException(
            status_code=503,
            detail="Today's practice isn't ready yet. Try again shortly.",
        )

    tomorrow = _unit_for(db, user_key, local_date + timedelta(days=1))
    return DailyTodayResponse(
        today=_to_response(today),
        tomorrow=_to_response(tomorrow) if tomorrow else None,
    )


def _restore_used_this_month(user: User, local_date: date) -> bool:
    """Whether this user's monthly restore is already spent.

    Compares (year, month) rather than "within the last 30 days": the cap the
    screen promises is "once per month", so a restore on the 31st must not block
    one on the 1st.
    """
    last = user.last_restore_on
    return last is not None and (last.year, last.month) == (
        local_date.year,
        local_date.month,
    )


def _streak_response(user: User, local_date: date) -> StreakResponse:
    used = _restore_used_this_month(user, local_date)
    return StreakResponse(
        currentStreak=user.streak_count,
        longestStreak=user.longest_streak,
        lastCompletedDate=user.last_practiced_on,
        completedToday=user.last_practiced_on == local_date,
        restorableStreak=user.lapsed_streak,
        canRestore=user.lapsed_streak > 0 and not used,
        restoreUsedThisMonth=used,
    )


def get_streak(db: Session, user: User, local_date: date) -> StreakResponse:
    """Current streak, with a lapse applied if one happened.

    The reset is computed on read rather than by a scheduled sweep: a streak can
    only lapse between two reads by the person it belongs to, so the read is the
    only moment it matters, and a nightly job would have to guess each user's
    timezone to know when their day ended.
    """
    last = user.last_practiced_on
    lapsed = user.streak_count > 0 and (
        last is None or last < local_date - timedelta(days=1)
    )
    if lapsed:
        # Remembered before it is thrown away — this read is the only moment the
        # number still exists, and a restore later has nothing else to go on.
        # Kept at the highest lapse rather than overwritten: reading the streak
        # twice after a lapse must not reduce what a restore would give back to
        # the zero the first read just wrote.
        user.lapsed_streak = max(user.lapsed_streak, user.streak_count)
        user.streak_count = 0
        db.commit()
        db.refresh(user)

    return _streak_response(user, local_date)


def restore_streak(db: Session, user: User, local_date: date) -> StreakResponse:
    """Put a lapsed streak back, once per calendar month.

    `get_streak` is called first so a streak that lapsed but has not been read
    since is restorable too — otherwise whether the button worked would depend
    on whether the home screen happened to have fetched yet.
    """
    get_streak(db, user, local_date)

    if _restore_used_this_month(user, local_date):
        raise HTTPException(
            status_code=409,
            detail="You've already used your restore this month.",
        )
    if user.lapsed_streak <= 0:
        raise HTTPException(status_code=400, detail="There is no streak to restore.")

    user.streak_count = user.lapsed_streak
    user.lapsed_streak = 0
    user.last_restore_on = local_date
    # Yesterday, not today: the restore gives back what was lost, it does not
    # also practise for them. Today's session still has to happen, and
    # `mark_complete` reads this as "practised yesterday" and adds one.
    user.last_practiced_on = local_date - timedelta(days=1)
    user.longest_streak = max(user.longest_streak, user.streak_count)

    db.commit()
    db.refresh(user)
    return _streak_response(user, local_date)


def mark_complete(db: Session, user: User, local_date: date) -> StreakResponse:
    """Mark the user's local day as practised.

    Idempotent: a second tap on the same day is a no-op rather than a second
    increment. Viewing deliberately doesn't count — a streak that goes up for
    opening the app measures opening the app.
    """
    last = user.last_practiced_on

    if last is None or last < local_date - timedelta(days=1):
        user.streak_count = 1
    elif last == local_date - timedelta(days=1):
        user.streak_count += 1
    # last >= local_date: already done today, or the client's clock moved
    # backwards. Either way there is nothing to add and nothing to take away.

    if last is None or local_date > last:
        user.last_practiced_on = local_date

    user.longest_streak = max(user.longest_streak, user.streak_count)
    db.commit()
    db.refresh(user)

    return _streak_response(user, local_date)
