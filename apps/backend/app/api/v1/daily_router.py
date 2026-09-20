from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.controllers.daily_controller import (
    get_streak,
    get_today,
    mark_complete,
    restore_streak,
)
from app.db.database import get_db
from app.models.user_model import User
from app.schemas.daily_schema import (
    DailyTodayResponse,
    MarkCompleteRequest,
    RestoreStreakRequest,
    StreakResponse,
)

# Every route takes the caller's local date rather than deriving it from the
# server clock. "Today" and "a day missed" are both statements about the user's
# calendar, and the server has no idea what timezone they're in.
router = APIRouter(prefix="/daily-practice", tags=["Daily Practice"])


@router.get("/today", response_model=DailyTodayResponse)
def read_today(
    local_date: date = Query(..., description="The caller's local calendar date"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DailyTodayResponse:
    return get_today(db, current_user.public_id, local_date)


@router.post("/complete", response_model=StreakResponse)
def complete(
    payload: MarkCompleteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StreakResponse:
    return mark_complete(db, current_user, payload.localDate)


@router.get("/streak", response_model=StreakResponse)
def read_streak(
    local_date: date = Query(..., description="The caller's local calendar date"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StreakResponse:
    return get_streak(db, current_user, local_date)


@router.post("/restore", response_model=StreakResponse)
def restore(
    payload: RestoreStreakRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StreakResponse:
    """Bring a lapsed streak back. 409 when this month's restore is spent,
    400 when there is nothing to restore."""
    return restore_streak(db, current_user, payload.localDate)
