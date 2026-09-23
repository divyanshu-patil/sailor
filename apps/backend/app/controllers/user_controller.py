
from app.models.user_model import User
from app.schemas.user_schema import UserProfileUpdateRequest
from app.utils.nickname import (
    InvalidNickname,
    normalize_nickname,
    validate_nickname,
)
from sqlalchemy.exc import IntegrityError
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

    # Nickname is the one field with rules and a uniqueness constraint, so it is
    # handled here rather than in the generic loop below: the loop sets values
    # blindly, and a nickname must be validated and canonicalized before it can
    # be stored beside its normalized form.
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
            normalized = normalize_nickname(display)
            conflict = (
                db.query(User.id)
                .filter(
                    User.nickname_normalized == normalized,
                    User.id != current_user.id,
                )
                .first()
            )
            if conflict is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="That nickname is already taken.",
                )
            current_user.nickname = display
            current_user.nickname_normalized = normalized

    for field, value in update_data.items():
        # The completion flags only ever go false -> true. A client that sent
        # false — a stale cache, a replayed request — would put the account back
        # through a flow it has already finished.
        if field in ("onboarding_completed", "profile_setup_completed"):
            if not value:
                continue
        setattr(current_user, field, value)

    db.add(current_user)
    try:
        db.commit()
    except IntegrityError:
        # The check above can lose a race with another device. The partial
        # unique index is the authority; this turns its violation into the same
        # 409 the caller would have got from the check.
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That nickname is already taken.",
        )
    db.refresh(current_user)
    return current_user
