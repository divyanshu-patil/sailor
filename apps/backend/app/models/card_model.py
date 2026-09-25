from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
    JSON,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.utils.enums.speaking_style import SpeakingStyle

if TYPE_CHECKING:
    from app.models.deck_model import Deck


class Card(Base):
    """
    Represents a card in the database.
    This is the SQLAlchemy model for the `cards` table in Supabase.
    """
    __tablename__ = "cards"
    __table_args__ = (
        # Two cards in the same deck can never share a position -- catches
        UniqueConstraint("deck_id", "position", name="uq_cards_deck_id_position"),
    )

    # ids
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    deck_id: Mapped[int] = mapped_column(
        Integer,
        # ondelete="CASCADE" backs the ORM-level cascade with a DB-level one,
        # so cards can't be orphaned by a deck deletion that bypasses the ORM
        ForeignKey("decks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    position: Mapped[int] = mapped_column(Integer, nullable=False)

    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    keywords: Mapped[list[str]] = mapped_column(
        JSON,
        nullable=False,
        default=list,
        server_default=text("'[]'::json"),
    )

    # hex string representing the color of the card (e.g., "#FF5733") generate using logic not by ai.
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
        nullable=False,
    )

    # whenever card is updated by user version will increase by 1. This is used for optimistic concurrency control.
    version: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False,
        server_default=text("1"),
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

    # Relationship to the Deck model
    deck: Mapped["Deck"] = relationship(
        back_populates="cards"
    )

    __mapper_args__ = {"version_id_col": version}
