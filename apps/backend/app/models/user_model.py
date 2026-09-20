import enum
import secrets
from datetime import date, datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Date, DateTime, Enum as SAEnum, Integer, String, func, text
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

    # A 32-character cryptographically random hex identifier, assigned on insert.
    #
    # `id` stays the integer primary key — every foreign key in the schema points
    # at it, and changing that is a different job entirely. This exists because
    # the integer is *guessable*: it is 1, 2, 3, 4 in creation order, so anything
    # derived from it is predictable across users and leaks how many accounts
    # exist. Daily practice derives each user's content variation from it (see
    # daily_controller.select_variation), which is exactly the kind of use that
    # wants an unguessable value.
    #
    # Defaulted on the column rather than at the two call sites that build a User
    # (auth/dependencies.py and controllers/webhook_controller.py), so a row
    # cannot be inserted without one and the next call site that gets added
    # doesn't have to remember. `secrets`, not `random` — the latter is a
    # deterministic Mersenne Twister and is not safe for identifiers.
    public_id: Mapped[str] = mapped_column(
        String(32),
        unique=True,
        index=True,
        nullable=False,
        default=lambda: secrets.token_hex(16),
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
        SAEnum(
            ExperienceLevel,
            name="experience_level_enum",
            values_callable=lambda enum: [e.value for e in enum],
        ),
        nullable=True,
    )
    profession: Mapped[Optional[Profession]] = mapped_column(
        SAEnum(
            Profession,
            name="profession_enum",
            values_callable=lambda enum: [e.value for e in enum],
        ),
        nullable=True,
    )

    subscription_tier: Mapped[SubscriptionTier] = mapped_column(
        SAEnum(
            SubscriptionTier,
            name="subscription_tier_enum",
            values_callable=lambda enum: [e.value for e in enum],
        ),
        default=SubscriptionTier.SKETOS,
        server_default=SubscriptionTier.SKETOS.value,
        nullable=False,
    )

    role: Mapped[UserRole] = mapped_column(
        SAEnum(
            UserRole,
            name="user_role_enum",
            values_callable=lambda enum: [e.value for e in enum],
        ),
        default=UserRole.USER,
        server_default=UserRole.USER.value,
        nullable=False,
    )

    # --- usage tracking for rate limiting / quota enforcement -------------------
    # Written only by app/services/quota.py, and only through a single atomic
    # UPDATE — never read-then-write from Python, or two requests arriving
    # together both spend the last credit. The period is a rolling 30 days that
    # rolls itself forward on first use after it lapses, so nothing has to run
    # on a schedule to reset it.
    monthly_generations_used: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default=text("0"),
    )
    usage_period_started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )

    # When subscription_tier above was last confirmed against RevenueCat, which
    # is what makes that column a *cache* rather than a fact of its own. Null
    # means never checked — treated as stale, so the first gated request looks
    # it up. See quota.resolve_tier.
    entitlement_checked_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )

    # --- daily practice streak -------------------------------------------------
    # Three columns on `users` rather than a table of their own: there is exactly
    # one row per user, it is never queried without the user, and a separate
    # table would only add a join and a row that has to be created before the
    # first write. `last_practiced_on` is a *local* date supplied by the client
    # (see daily_controller) — a streak is about the user's calendar days, and
    # storing it as UTC would break the boundary for anyone west of London.
    streak_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0"),
    )
    longest_streak: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0"),
    )
    last_practiced_on: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    # --- streak restore --------------------------------------------------------
    # What `streak_count` held at the moment it lapsed. `get_streak` zeroes the
    # live count on read, so without this the number a restore is meant to bring
    # back is gone by the time anyone asks for it — `longest_streak` is not a
    # substitute, it is a personal best from any time in the past.
    # Zero means "nothing to restore", which is also the state after a restore
    # has been spent.
    lapsed_streak: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0"),
    )
    #: The client-local date a restore was last used, for the one-per-month cap.
    #: A date rather than a counter: the cap is per calendar month, so the month
    #: it fell in is the whole of the state, and it needs no monthly reset job.
    last_restore_on: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

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