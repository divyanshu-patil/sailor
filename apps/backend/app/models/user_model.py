import enum
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, DateTime, Enum as SAEnum, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.deck_model import Deck

class UserRole(str, enum.Enum):
    USER = "user"
    ADMIN = "admin"

class SubscriptionTier(str, enum.Enum):
    SKETOS = "sketos"  
    METRIOS = "metrios" 
    GLYKOS = "glykos"    


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

    # Was indexed but NOT unique before -- two rows could share an email.
    # Fixed here; add a matching unique index/constraint in the migration.
    email: Mapped[str] = mapped_column(
        String,
        unique=True,
        index=True,
        nullable=False,
    )

    # Optional profile fields
    name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    occupation: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    subscription_tier: Mapped[SubscriptionTier] = mapped_column(
        SAEnum(SubscriptionTier, name="subscription_tier_enum"),
        default=SubscriptionTier.FREE,
        server_default=SubscriptionTier.FREE.value,
        nullable=False,
    )

    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, name="user_role_enum"),
        default=UserRole.USER,
        server_default=UserRole.USER.value,
        nullable=False,
    )

    # --- account status --------------------------------------------------------
    # Lets you suspend/ban a user (e.g. abuse of the AI generation endpoints)
    # without deleting their row -- deleting would cascade-delete every deck
    # they own via the relationship below.
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # --- usage tracking for rate limiting / quota enforcement -------------------
    # Check-and-increment this before queuing a script-generation Celery task,
    # gate it against a per-tier limit, and reset usage_period_started_at on
    # a schedule (cron/beat task). Keeps one user from drowning out everyone
    # else's queue when load is high.
    monthly_generations_used: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    usage_period_started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
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
    decks: Mapped[List["Deck"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"User(id={self.id!r}, email={self.email!r}, role={self.role!r})"