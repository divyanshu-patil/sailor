from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.controllers import onboarding_controller
from app.db.database import get_db
from app.models.user_model import User
from app.schemas.onboarding_schema import (
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
