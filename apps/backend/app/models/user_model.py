from datetime import datetime
from typing import Optional


from sqlalchemy import DateTime, String, func, Integer
from sqlalchemy.orm import relationship, Mapped, mapped_column
from app.db.base import Base
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.deck_model import Deck

class User(Base):
    """
    Represents a user in the database.
    This is the SQLAlchemy model for the `users` table in Supabase.

    """
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    clerk_user_id: Mapped[str] = mapped_column(
        String,
        unique=True,
        index=True,
        nullable=False,
    )

    email: Mapped[str] = mapped_column(
        String,
        unique=True,
        index=True,
        nullable=False,
    )

    # Optional profile fields
    name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    occupation: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    subscription_tier: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # "user" or "admin"
    role: Mapped[str] = mapped_column(
        String,
        default="user",
        nullable=False,
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

    #  Relationship to the Deck model one  ---> many relationship
    decks: Mapped[list["Deck"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"User(id={self.id!r}, email={self.email!r}, role={self.role!r})"
    
