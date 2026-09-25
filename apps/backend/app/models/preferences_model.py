from datetime import datetime

from sqlalchemy import DateTime, String, Boolean, ForeignKey, func, Integer
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class UserPreferences(Base):
    """
    Represents user preferences in the database.
    Stores only: practice_reminders_enabled, practice_reminder_time, default_mood
    """
    __tablename__ = "user_preferences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id"),
        unique=True,
        index=True,
        nullable=False,
    )
    practice_reminders_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    practice_reminder_time: Mapped[str] = mapped_column(String, default="09:00")
    default_mood: Mapped[str] = mapped_column(String, default="confident")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"UserPreferences(user_id={self.user_id}, default_mood={self.default_mood!r})"
