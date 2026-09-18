from datetime import date, datetime

from sqlalchemy import Date, DateTime, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class DailyContent(Base):
    """One pre-generated practice snippet, applying one named framework.

    Generated days ahead of time by `app.tasks.daily_tasks.refill_daily_content`,
    never on the request path: the user's first tap of the day should not wait on
    a model call, and generating per-request would mean paying for one call per
    user per day instead of one per day.

    `framework` is an id from services/daily/frameworks.py — the named structure
    the body demonstrates (PREP, STAR, SCQA, ...). It replaced a `type` column
    holding vague subjects like "structure", which produced content that
    described a topic instead of teaching a repeatable move.

    `framework`, `mood` and `situation` are all plain strings rather than DB
    enums, for the same reason `user_preferences.default_mood` is: the framework
    library is explicitly a seed set meant to grow, and adding an entry to it
    should not require a migration on a table nothing joins against.
    """
    __tablename__ = "daily_content"
    __table_args__ = (
        UniqueConstraint("date", "variation_index", name="uq_daily_content_date_variation"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    framework: Mapped[str] = mapped_column(String(48), nullable=False)
    #: The snippet's own topic, e.g. "Pitching a slower rollout" — what the
    #: speech is ABOUT, which is a different thing from the framework it uses to
    #: say it. The intro screen shows this as "Today's topic"; showing the
    #: framework name there answered the wrong question.
    title: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    mood: Mapped[str] = mapped_column(String(32), nullable=False)
    situation: Mapped[str] = mapped_column(String(32), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    tip: Mapped[str] = mapped_column(Text, nullable=False)
    variation_index: Mapped[int] = mapped_column(Integer, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )

    def __repr__(self) -> str:
        return f"DailyContent(date={self.date!r}, framework={self.framework!r}, v={self.variation_index})"
