from datetime import datetime
from decimal import Decimal
from app.utils.enums.speaking_style import SpeakingStyle

from sqlalchemy import Integer, String, ForeignKey, DateTime, func, Boolean, Numeric, Enum
from sqlalchemy.orm import relationship, Mapped, mapped_column
from app.db.base import Base
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.deck_model import Deck

class Card(Base):
    """
    Represents a card in the database.
    This is the SQLAlchemy model for the `cards` table in Supabase.

    """
    __tablename__ = "cards"

    # ids
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    deck_id: Mapped[int] = mapped_column(Integer, ForeignKey("decks.id"), nullable=False, index=True)

    position: Mapped[int] = mapped_column(Integer, nullable=False)

    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False)

    # hex string representing the color of the card (e.g., "#FF5733")
    color: Mapped[str] = mapped_column(String, nullable=False)

    impact: Mapped[Decimal] = mapped_column(
        Numeric(3, 2),
        nullable=False,
    )

    delivery: Mapped[SpeakingStyle] = mapped_column(
        Enum(
        SpeakingStyle,
        name="speaking_style",
        ), 
        nullable=False
    )

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
    deck: Mapped["Deck"] = relationship(
        back_populates="cards"
    )