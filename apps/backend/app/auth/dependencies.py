from fastapi import Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.clerk import get_current_clerk_user, ClerkUser
from app.db.database import get_db
from app.models.user_model import User


def resolve_user_from_claims(claims: dict, db: Session) -> User:
    """
    Resolves a verified Clerk JWT's claims to a row in our own `users` table.
    Shared by get_current_user (HTTP requests) and the deck progress WebSocket
    in deck_router.py, which authenticates via a query param and so can't go
    through get_current_clerk_user's normal dependency chain.

    - Primary sync path: the Clerk webhook (see webhook_controller.py) keeps this
      table up to date on user.created / user.updated / user.deleted.
    - Fallback: if this runs before the webhook has fired (e.g. right after
      sign-up), it creates the row itself so the request doesn't fail.
    """
    clerk_user_id = claims["sub"]
    email = claims.get("email") or ""

    user = db.query(User).filter(User.clerk_user_id == clerk_user_id).one_or_none()
    if user is not None:
        return user

    user = User(
        clerk_user_id=clerk_user_id,
        email=email,
        role="user",
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        # Lost a race with the webhook firing at the same moment — just read what it wrote.
        db.rollback()
        user = db.query(User).filter(User.clerk_user_id == clerk_user_id).one_or_none()
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to resolve user record.",
            )
    else:
        db.refresh(user)

    return user


def get_current_user(
    clerk_user: ClerkUser = Depends(get_current_clerk_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Returns the SQLAlchemy User object (not a dict) so callers get attribute access
    and stay consistent with the rest of the ORM-based code.
    """
    return resolve_user_from_claims(clerk_user.claims, db)


def require_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Extends get_current_user — additionally requires role == 'admin'."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )
    return current_user