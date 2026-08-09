from datetime import datetime
import enum

from sqlalchemy import Index, Integer, String, ForeignKey, DateTime, false, func, Boolean, Enum as SAEnum, text
from sqlalchemy.orm import relationship, Mapped, mapped_column
from app.db.base import Base
from typing import TYPE_CHECKING, Optional
from app.utils.enums.deck_enums import GenerationStatus, AudienceType
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
        # Supports: WHERE is_public = true AND is_deleted = false
        #           ORDER BY created_at DESC, id DESC
        # Partial (postgresql_where) so the index only contains rows this
        # query cares about — most decks are private, no reason to index them
        # for the public feed.
        Index(
            "ix_decks_public_feed",
            "is_public", "created_at", "id",
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

    # Public deck sharing 
    is_public: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,          # ORM default
        server_default=false(), # Database default
    )

    audio_key: Mapped[Optional[str]] = mapped_column(String, nullable=True)       # MinIO object key, or None
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