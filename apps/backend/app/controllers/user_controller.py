
from app.models.user_model import User
from app.schemas.user_schema import UserProfileUpdateRequest
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

def get_profile(current_user: User) -> User:
    """
    Returns the current user's profile.
    FastAPI will serialize this through the response_model (UserProfileResponse)
    at the route layer, so no manual dict conversion is needed here.
    """
    return current_user

def update_profile(current_user: User, payload: UserProfileUpdateRequest, db: Session) -> User:
    update_data = payload.model_dump(exclude_unset=True)

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