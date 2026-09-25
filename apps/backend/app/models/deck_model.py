from datetime import datetime

from sqlalchemy import Index, Integer, String, ForeignKey, DateTime, false, func, select, Boolean, Enum as SAEnum, text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import relationship, Mapped, column_property, mapped_column
from app.db.base import Base
from app.models.deck_save_model import DeckSave
from typing import TYPE_CHECKING, Optional
from app.utils.enums.deck_enums import DeckCategory, GenerationStatus, AudienceType
if TYPE_CHECKING:
    from app.models.user_model import User
    from app.models.card_model import Card



class Deck(Base):
    """
    Represents a deck in the database.
    This is the SQLAlchemy model for the `decks` table in Supabase.

    """
    __tablename__ = "decks"
    __table_args__ = (
        Index("ix_decks_user_id_created_at", "user_id", "created_at"),
        # The two orders the discover feed offers, each as a partial index over
        # published decks only — most decks are private, no reason to index them
        # for a feed they can never appear in. Both carry `id` so the keyset
        # cursor (sort_key, id) seeks straight into the index instead of
        # re-scanning from the top on every page.
        Index(
            "ix_decks_public_recent",
            "published_at", "id",
            postgresql_where=text("is_public = true AND is_deleted = false"),
        ),
        Index(
            "ix_decks_public_popular",
            "practice_count", "id",
            postgresql_where=text("is_public = true AND is_deleted = false"),
        ),
        # Tag filtering is `tags && ARRAY['x']`, which only a GIN index can serve.
        Index(
            "ix_decks_public_tags",
            "tags",
            postgresql_using="gin",
            postgresql_where=text("is_public = true AND is_deleted = false"),
        ),
    )

    # ids
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    title: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True)

     # Nullable on purpose: the row exists the instant the user hits "create",
    # but the script itself doesn't exist until the AI job finishes.
    script: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    recording_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # hex string representing the color of the deck (e.g., "#FF5733")
    color: Mapped[str] = mapped_column(String, nullable=False)

    duration_mins: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    audience: Mapped[AudienceType] = mapped_column(
        SAEnum(
            AudienceType,
            values_callable=lambda enum: [e.value for e in enum],
            name="audience_type_enum",
            native_enum=True,
        ),
        nullable=False,
        default=AudienceType.GENERAL,
        server_default=AudienceType.GENERAL.value,
    )

    card_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_favorite: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # --- public sharing -------------------------------------------------------
    # is_public is the *visibility switch* only. The three fields under it are
    # the published metadata, and they deliberately outlive an unpublish: taking
    # a deck out of discovery shouldn't make the author retype its description,
    # tags and category to put it back.
    is_public: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,          # ORM default
        server_default=false(), # Database default
    )

    tags: Mapped[list[str]] = mapped_column(
        ARRAY(String),
        nullable=False,
        default=list,
        server_default=text("'{}'::varchar[]"),
    )

    category: Mapped[Optional[DeckCategory]] = mapped_column(
        SAEnum(
            DeckCategory,
            values_callable=lambda enum: [e.value for e in enum],
            name="deck_category_enum",
            native_enum=True,
        ),
        nullable=True,
    )

    # Social proof on the feed card. Counts every practice run, the author's
    # included — it's a "this deck gets used" signal, not an audience metric.
    practice_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default=text("0"),
    )

    # When it *first* entered discovery. Feed order, and stable across an
    # unpublish/republish so a deck can't farm the top of the feed by toggling.
    published_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    audio_key: Mapped[Optional[str]] = mapped_column(String, nullable=True)       # S3 object key, or None
    audio_uploaded_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # AI script generation tracking
    # One AI job per deck (generate the markdown script), so this lives
    # directly on Deck rather than in a separate jobs table.
    generation_status: Mapped[GenerationStatus] = mapped_column(
        SAEnum(
            GenerationStatus,
            values_callable=lambda enum: [e.value for e in enum],
            name="generation_status_enum",
            native_enum=True,
        ),
        nullable=False,
        default=GenerationStatus.PENDING,
        server_default=GenerationStatus.PENDING.value,
        index=True,
    )
    celery_task_id: Mapped[Optional[str]] = mapped_column(String, nullable=True, index=True)
    generation_error: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    generation_retry_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default=text("0"),
    )

    cards_generation_status: Mapped[GenerationStatus] = mapped_column(
        SAEnum(
            GenerationStatus,
            values_callable=lambda enum: [e.value for e in enum],
            name="generation_status_enum",
            native_enum=True,
        ),
        nullable=False,
        default=GenerationStatus.PENDING,
        server_default=GenerationStatus.PENDING.value,
        index=True,
    )
    cards_celery_task_id: Mapped[Optional[str]] = mapped_column(String, nullable=True, index=True)
    cards_generation_error: Mapped[Optional[str]] = mapped_column(String, nullable=True)


    # soft delete
    # Never hard-delete user content by default -- lets you undo accidental
    # deletes and keeps FK history intact for analytics/support.
    is_deleted: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=false(),
        index=True,
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


    # Prevents a lost update when e.g. a Celery worker writes the finished
    # script at the same moment the user edits the title from the app.
    version: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
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


    # Relationship to the User model
    user: Mapped["User"] = relationship(
        back_populates="decks"
    )

    cards: Mapped[list["Card"]] = relationship(
        back_populates="deck",
        cascade="all, delete-orphan",
    )

    __mapper_args__ = {"version_id_col": version}


# How many people have bookmarked this deck.
#
# Read from deck_saves instead of a counter column beside practice_count: the
# save rows already are the truth, so a stored number could only drift from
# them — and unsaving would have to remember whether a row was actually deleted
# before decrementing. practice_count has no such table behind it, which is why
# that one *is* a column.
#
# Declared as a column_property so it rides along in the same SELECT as the deck
# (a deferred one would be a query per row on a 20-card feed page). The cost is
# one indexed count per row — see ix_deck_saves_deck_id.
Deck.save_count = column_property(
    select(func.count(DeckSave.id))
    .where(DeckSave.deck_id == Deck.id)
    .correlate_except(DeckSave)
    .scalar_subquery(),
    # Ordinary attribute access on a detached deck (e.g. after commit) would
    # otherwise emit a fresh query; the feed serialises before detaching.
    deferred=False,
)
