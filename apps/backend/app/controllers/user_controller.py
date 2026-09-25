
from app.models.onboarding_model import OnboardingProgress
from app.models.user_model import User
from app.schemas.user_schema import UserProfileUpdateRequest
from app.utils.nickname import (
    InvalidNickname,
    normalize_nickname,
    validate_nickname,
)
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

def get_profile(current_user: User, db: Session) -> User:
    """
    Returns the current user's profile.
    FastAPI will serialize this through the response_model (UserProfileResponse)
    at the route layer, so no manual dict conversion is needed here.
    """
    # Accounts that finished onboarding before the progress save started
    # setting the flag have a completed record and a false flag. The first
    # read puts that right, so the app's routing can trust the flag alone.
    if not current_user.onboarding_completed:
        finished = (
            db.query(OnboardingProgress.id)
            .filter(
                OnboardingProgress.user_id == current_user.id,
                OnboardingProgress.status == "completed",
            )
            .first()
        )
        if finished is not None:
            current_user.onboarding_completed = True
            db.commit()
            db.refresh(current_user)
    return current_user

def update_profile(current_user: User, payload: UserProfileUpdateRequest, db: Session) -> User:
    update_data = payload.model_dump(exclude_unset=True)

    # Nickname is the one field with rules, so it is handled here rather than in
    # the generic loop below: the loop sets values blindly, and a nickname must
    # be validated and canonicalized before it can be stored beside its
    # normalized form. Nicknames are not unique, so there is no conflict check.
    if "nickname" in update_data:
        raw = update_data.pop("nickname")
        if raw is None:
            current_user.nickname = None
            current_user.nickname_normalized = None
        else:
            try:
                display = validate_nickname(raw)
            except InvalidNickname as exc:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=exc.message,
                )
            current_user.nickname = display
            current_user.nickname_normalized = normalize_nickname(display)

    for field, value in update_data.items():
        # The completion flags only ever go false -> true. A client that sent
        # false — a stale cache, a replayed request — would put the account back
        # through a flow it has already finished.
        if field in ("onboarding_completed", "profile_setup_completed"):
            if not value:
                continue
        setattr(current_user, field, value)

    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user
