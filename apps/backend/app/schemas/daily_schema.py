from datetime import date
from typing import Optional

from pydantic import BaseModel


class DailyContentUnitResponse(BaseModel):
    """camelCase to match what the app already expects from every other
    endpoint (see preferences_schema) — the client has no case-mapping layer."""
    id: str
    date: date
    #: What this snippet is about, e.g. "Pitching a slower rollout".
    title: str
    framework: str
    #: Human label for `framework`, resolved server-side. Sent with the unit so
    #: the client never holds its own copy of the framework table — that table
    #: is a growing seed set, and a second copy in the app would drift the day
    #: someone adds an entry.
    frameworkLabel: str
    #: The framework's step order, e.g. ["Point", "Reason", "Example", "Point"].
    #: Sent so the practice screen can teach the structure the body is
    #: demonstrating — the whole reason the content is framework-based.
    frameworkSteps: list[str]
    #: One line on what the framework is for, shown behind the info button.
    frameworkDescription: str
    #: One gloss per step, positionally aligned with `frameworkSteps`.
    frameworkStepHints: list[str]
    #: Human labels for the situations this framework suits.
    frameworkBestFor: list[str]
    #: Lucide glyph name for the explainer's header tile.
    frameworkIcon: str
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

    # --- restore ---------------------------------------------------------------
    # The streak a restore would bring back. 0 means there is nothing to
    # restore, which is the ordinary state for anyone who has not lapsed.
    restorableStreak: int = 0
    # Whether a restore would be accepted right now. False covers both "nothing
    # to restore" and "already used this month"; the two look different on
    # screen, so `restoreUsedThisMonth` tells them apart rather than the client
    # inferring it from a date it would have to month-compare itself.
    canRestore: bool = False
    restoreUsedThisMonth: bool = False


class RestoreStreakRequest(BaseModel):
    """The client's local calendar date — same reasoning as MarkCompleteRequest.
    The one-per-month cap is a statement about the user's calendar month."""
    localDate: date


class MarkCompleteRequest(BaseModel):
    """The client's local calendar date. Required, not defaulted server-side:
    the server's idea of "today" is UTC, and a user practising at 9pm in Los
    Angeles would have it land on tomorrow."""
    localDate: date
