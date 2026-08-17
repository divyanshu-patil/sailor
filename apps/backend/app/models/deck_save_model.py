from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class DeckSave(Base):
    """
    A bookmark: "this public deck, in my saved list".

    Deliberately a reference and not a copy. Saving a public deck does not put a
    duplicate in the user's own library — the deck stays the author's, keeps its
    author's edits, and disappears from the saved list the moment they unpublish
    it. That's the difference between saving and the remix feature the app
    doesn't have.
    """
    __tablename__ = "deck_saves"
    __table_args__ = (
        # One row per (user, deck). The save endpoint is idempotent and leans on
        # this rather than on checking first, which would race two taps.
        UniqueConstraint("user_id", "deck_id", name="uq_deck_saves_user_deck"),
        # The saved list is "my saves, newest first" — one index, one scan.
        Index("ix_deck_saves_user_created", "user_id", "created_at"),
        # The other direction: "how many saves does this deck have?", which the
        # unique constraint above can't serve because it leads with user_id.
        Index("ix_deck_saves_deck_id", "deck_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    deck_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("decks.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
