from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.db.database import get_db
from app.models.user_model import User
from app.schemas.preferences_schema import UserPreferencesCreate, UserPreferencesResponse, UserPreferencesUpdate
from app.controllers.preferences_controller import create_user_preferences, get_user_preferences, update_user_preferences

router = APIRouter(prefix="/preferences", tags=["Decks"])


@router.get("", response_model=UserPreferencesResponse)
def get_preferences(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserPreferencesResponse:
    return get_user_preferences(db, current_user.id)

@router.post("", response_model=UserPreferencesResponse)
def create_preferences(
    initial: UserPreferencesCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserPreferencesResponse:
    return create_user_preferences(db, current_user.id, initial)


@router.patch("", response_model=UserPreferencesResponse)
def update_preferences(
    updates: UserPreferencesUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserPreferencesResponse:
    return update_user_preferences(db, current_user.id, updates)