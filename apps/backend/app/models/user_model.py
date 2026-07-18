import enum
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import DateTime, Enum as SAEnum, Integer, String, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.utils.enums.user_enums import ExperienceLevel, Profession

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.deck_model import Deck


class UserRole(str, enum.Enum):
    USER = "user"
    ADMIN = "admin"


class SubscriptionTier(str, enum.Enum):
    """
    Named after the traditional Greek coffee sweetness scale, low to high --
    sketos (plain/unsweetened) -> metrios (medium) -> glykos (sweet).
    Maps to free -> pro -> team.
    """
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

    email: Mapped[str] = mapped_column(
        String,
        unique=True,
        index=True,
        nullable=False,
    )

    full_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    nickname: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)

    experience_level: Mapped[Optional[ExperienceLevel]] = mapped_column(
        SAEnum(ExperienceLevel, name="experience_level_enum"),
        nullable=True,
    )
    profession: Mapped[Optional[Profession]] = mapped_column(
        SAEnum(Profession, name="profession_enum"),
        nullable=True,
    )

    subscription_tier: Mapped[SubscriptionTier] = mapped_column(
        SAEnum(SubscriptionTier, name="subscription_tier_enum"),
        default=SubscriptionTier.SKETOS,
        server_default=SubscriptionTier.SKETOS.value,
        nullable=False,
    )

    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, name="user_role_enum"),
        default=UserRole.USER,
        server_default=UserRole.USER.value,
        nullable=False,
    )

    # --- usage tracking for rate limiting / quota enforcement -------------------
    # Check-and-increment this before queuing a script-generation Celery task,
    # gate it against a per-tier limit, and reset usage_period_started_at on
    # a schedule (cron/beat task). Keeps one user from drowning out everyone
    # else's queue when load is high.
    monthly_generations_used: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default=text("0"),
    )
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