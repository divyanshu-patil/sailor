from datetime import datetime

from sqlalchemy import Integer, String, ForeignKey, DateTime, func, Boolean
from sqlalchemy.orm import relationship, Mapped, mapped_column
from app.db.base import Base
from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from app.models.user_model import User
    from app.models.card_model import Card

class Deck(Base):
    """
    Represents a deck in the database.
    This is the SQLAlchemy model for the `decks` table in Supabase.

    """
    __tablename__ = "decks"

    # ids
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    script: Mapped[str] = mapped_column(String, nullable=True)


    # hex string representing the color of the deck (e.g., "#FF5733")
    color: Mapped[str] = mapped_column(String, nullable=False)

    duration_mins: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    card_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    is_favorite: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

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


    # Relationship to the User model
    user: Mapped["User"] = relationship(
        back_populates="decks"
    )

    cards: Mapped[list["Card"]] = relationship(
        back_populates="deck",
        cascade="all, delete-orphan",
    )