import enum
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class DailyContentType(str, enum.Enum):
    """What a day's snippet is *about*. One type per calendar day, the same for
    everyone — a shared daily theme is cacheable, makes the copy on the screen
    ("Today: openings") mean something, and the per-user variation below is what
    keeps it from being identical for two people side by side."""
    OPENING_HOOK = "opening_hook"
    ENDING = "ending"
    STRUCTURE = "structure"
    FILLER_ALTERNATIVE = "filler_alternative"
    STORY_ANECDOTE = "story_anecdote"
    GENERAL_TIP = "general_tip"


class DailyContent(Base):
    """One pre-generated practice snippet.

    Generated days ahead of time by `app.tasks.daily_tasks.refill_daily_content`,
    never on the request path: the user's first tap of the day should not wait on
    a model call, and generating per-request would mean paying for one call per
    user per day instead of one per day.

    `mood` and `situation` reuse the app's existing vocabularies (ScriptMood,
    DeckCategory) rather than inventing a parallel set — they are stored as
    plain strings for the same reason `user_preferences.default_mood` is: adding
    a value shouldn't need a migration on a table nothing joins against.
    """
    __tablename__ = "daily_content"
    __table_args__ = (
        UniqueConstraint("date", "variation_index", name="uq_daily_content_date_variation"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    type: Mapped[str] = mapped_column(String(32), nullable=False)
    mood: Mapped[str] = mapped_column(String(32), nullable=False)
    situation: Mapped[str] = mapped_column(String(32), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    tip: Mapped[str] = mapped_column(Text, nullable=False)
    variation_index: Mapped[int] = mapped_column(Integer, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )

    def __repr__(self) -> str:
        return f"DailyContent(date={self.date!r}, type={self.type!r}, v={self.variation_index})"
