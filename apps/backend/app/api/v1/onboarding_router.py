from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, get_current_user_optional
from app.controllers import onboarding_controller
from app.db.database import get_db
from app.models.user_model import User
from app.schemas.onboarding_schema import (
    NicknameAvailabilityResponse,
    OnboardingProgressResponse,
    OnboardingProgressUpdateRequest,
)


router = APIRouter(prefix="/users", tags=["Onboarding"])


@router.get(
    "/onboarding",
    response_model=OnboardingProgressResponse,
    summary="Get my onboarding progress",
    description=(
        "Returns the account's persisted onboarding position. An account that "
        "has never written any progress is answered with a not_started shape "
        "rather than creating a row."
    ),
)
def get_my_onboarding(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return onboarding_controller.get_progress(current_user, db)


@router.put(
    "/onboarding",
    response_model=OnboardingProgressResponse,
    summary="Save my onboarding progress",
    description=(
        "Idempotent full-state upsert. Safe to retry: re-sending the same body "
        "writes the same row and never creates a second. Completion is one-way."
    ),
)
def save_my_onboarding(
    payload: OnboardingProgressUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return onboarding_controller.upsert_progress(current_user, payload, db)


@router.get(
    "/nickname-available",
    response_model=NicknameAvailabilityResponse,
    summary="Check whether a nickname is free",
    description=(
        "Public and advisory: the nickname is picked during pre-auth onboarding, "
        "so this must answer without an account. It does not reserve the name — "
        "the authoritative decision is the 409 from PATCH /profile after sign-up, "
        "because another device can claim the nickname in between."
    ),
)
def check_nickname(
    nickname: str = Query(..., min_length=1, max_length=64),
    current_user: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    return onboarding_controller.check_nickname_available(current_user, nickname, db)
