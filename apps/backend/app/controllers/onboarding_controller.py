"""Onboarding workflow persistence.

The endpoint is a full-state upsert, and it is idempotent: replaying the same
PUT (a retried request whose first attempt actually succeeded) writes the same
values and bumps the same row, never a second one.
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models.onboarding_model import OnboardingProgress
from app.models.user_model import User
from app.schemas.onboarding_schema import (
    NicknameAvailabilityResponse,
    OnboardingProgressUpdateRequest,
)
from app.utils.nickname import (
    InvalidNickname,
    normalize_nickname,
    validate_nickname,
)

#: What a client that has never written progress is told. Kept in step with the
#: mobile app's ONBOARDING_FLOW_VERSION; a mismatch is how a client knows the
#: flow it is running is not the one this record was written by.
DEFAULT_FLOW_VERSION = "2026-09"


def get_progress(current_user: User, db: Session) -> OnboardingProgress:
    row = (
        db.query(OnboardingProgress)
        .filter(OnboardingProgress.user_id == current_user.id)
        .first()
    )
    if row is not None:
        return row
    # Transient, deliberately not added to the session: GET must not create a
    # row for every account that merely exists.
    return OnboardingProgress(
        user_id=current_user.id,
        flow_version=DEFAULT_FLOW_VERSION,
        status="not_started",
        current_step_id=None,
        completed_steps=[],
        data={},
        completed_at=None,
        updated_at=None,
    )


def upsert_progress(
    current_user: User,
    payload: OnboardingProgressUpdateRequest,
    db: Session,
) -> OnboardingProgress:
    row = (
        db.query(OnboardingProgress)
        .filter(OnboardingProgress.user_id == current_user.id)
        .first()
    )

    if row is None:
        row = OnboardingProgress(user_id=current_user.id)
        db.add(row)

    # Completion is one-way, mirroring the flags on `users`: a stale client
    # replaying an in_progress write must not put an account back through a flow
    # it has already finished.
    if row.status == "completed" and payload.status != "completed":
        db.commit()
        db.refresh(row)
        return row

    row.flow_version = payload.flow_version
    row.status = payload.status
    row.current_step_id = payload.current_step_id
    # Dedupe while preserving order -- completed_steps is a set semantically and
    # a retried step should not appear twice.
    row.completed_steps = list(dict.fromkeys(payload.completed_steps))
    row.data = payload.data
    row.completed_at = payload.completed_at

    if row.status == "completed" and row.completed_at is None:
        row.completed_at = datetime.now(timezone.utc)
    # A flow that is not finished has no completion time. Leaving a stale one
    # behind would make the record claim two contradictory things.
    if row.status != "completed":
        row.completed_at = None

    db.commit()
    db.refresh(row)
    return row


def check_nickname_available(
    current_user: Optional[User], nickname: str, db: Session
) -> NicknameAvailabilityResponse:
    """Advisory availability check.

    Public on purpose: the nickname is chosen during pre-auth onboarding, before
    an account exists. `current_user` is only used to ignore the caller's own
    row when they are signed in (fixing a conflict, or editing the profile);
    a signed-out caller just checks whether the name is free.
    """
    try:
        display = validate_nickname(nickname)
    except InvalidNickname as exc:
        return NicknameAvailabilityResponse(
            nickname=nickname.strip(),
            normalized=normalize_nickname(nickname),
            available=False,
            reason="invalid" if exc.code != "empty" else "empty",
        )

    normalized = normalize_nickname(display)
    # The index is the real guard; this query exists only so the UI can tell the
    # user before they commit. The 409 on the save is what decides.
    query = db.query(User.id).filter(User.nickname_normalized == normalized)
    if current_user is not None:
        query = query.filter(User.id != current_user.id)
    taken = query.first() is not None
    return NicknameAvailabilityResponse(
        nickname=display,
        normalized=normalized,
        available=not taken,
        reason="taken" if taken else None,
    )
