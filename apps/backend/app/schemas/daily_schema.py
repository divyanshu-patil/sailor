from datetime import date
from typing import Optional

from pydantic import BaseModel


class DailyContentUnitResponse(BaseModel):
    """camelCase to match what the app already expects from every other
    endpoint (see preferences_schema) — the client has no case-mapping layer."""
    id: str
    date: date
    type: str
    mood: str
    situation: str
    body: str
    tip: str
    variationIndex: int


class DailyTodayResponse(BaseModel):
    today: DailyContentUnitResponse
    # Pre-fetched so the widget can be given a timeline entry for local midnight
    # and flip over without the app being opened. Null when the buffer hasn't
    # reached tomorrow yet, which the client treats as "no timeline entry".
    tomorrow: Optional[DailyContentUnitResponse] = None


class StreakResponse(BaseModel):
    currentStreak: int
    longestStreak: int
    lastCompletedDate: Optional[date] = None
    # Whether the *local date the client asked about* is already marked done —
    # saves the app deriving it from lastCompletedDate and getting the timezone
    # wrong in the process.
    completedToday: bool


class MarkCompleteRequest(BaseModel):
    """The client's local calendar date. Required, not defaulted server-side:
    the server's idea of "today" is UTC, and a user practising at 9pm in Los
    Angeles would have it land on tomorrow."""
    localDate: date
