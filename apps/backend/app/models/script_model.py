from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    false,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.utils.enums.deck_enums import AudienceType, GenerationStatus, ScriptVersionKind

if TYPE_CHECKING:
    from app.models.attachment_model import Attachment
    from app.models.deck_model import Deck
    from app.models.user_model import User


class ScriptGeneration(Base):
    """
    A script the user asked for, which may or may not ever become a deck.

    This table exists to kill the ghost deck. Generation used to write straight
    onto a `decks` row, so the deck was created the moment the user tapped
    Generate — and every abandoned or discarded script left a deck with no cards
    sitting in the grid forever. A generation now owns the whole
    brief -> script -> revision lifecycle on its own, and a deck is created only
    when the user actually accepts the result (see `deck_id` below).

    The brief that produced it is stored here rather than on the deck, because
    it's this row that a retry re-runs and this row that dedupes a repeat
    submission of the same brief.
    """

    __tablename__ = "script_generations"
    __table_args__ = (
        # The dedupe lookup: "has this user already asked for exactly this?"
        # Not unique — a user is allowed to deliberately generate the same brief
        # twice, once the first result has been turned into a deck or discarded.
        Index("ix_script_generations_user_fingerprint", "user_id", "fingerprint"),
        # Backs the "unfinished scripts" drafts list.
        Index("ix_script_generations_user_created", "user_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )

    # ---- the brief -------------------------------------------------------
    description: Mapped[str] = mapped_column(Text, nullable=False)
    duration_mins: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    card_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
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

    # The presenter's voice for this script: the mood they picked, plus the
    # profile fields (users.profession, users.experience_level) as they stood
    # when the brief was submitted. Copied onto the row rather than read off the
    # user at generation time for two reasons — the wizard lets either be
    # overridden for one script, and a revision months later has to be written
    # in the same voice as the script it is editing, not in whatever the user's
    # settings say today. Plain strings, validated by the request schema; the
    # native enum types would each need their own migration for no gain here.
    mood: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    profession: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    experience_level: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)

    # Hash of the four fields above. Recomputed on write rather than trusted from
    # the client, so "the same brief" means the same thing on every device — see
    # services/scripts/fingerprint.py.
    fingerprint: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    # Reference URLs, newline-separated. Stored on the generation rather than as
    # Attachment rows: a link has no bytes in MinIO, no size, and nothing to
    # extract, so an attachment row would be almost entirely null columns.
    # Kept because a revision needs the same references the script was written
    # against — same reason attachments keep their extracted text.
    links: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # ---- the result ------------------------------------------------------
    # Both nullable until the first run finishes. The *current* version is
    # denormalised here so the status endpoint and the drafts list don't have to
    # join to script_versions on every poll; the full history lives in that table.
    title: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    script: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    status: Mapped[GenerationStatus] = mapped_column(
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
    error: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # ---- lifecycle -------------------------------------------------------
    # Set when the user accepts the script and it becomes a real deck. This is
    # the line between a draft and a deck: a generation with a deck_id is done
    # with, everything else is still a draft the user can come back to.
    deck_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("decks.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Card generation runs against the *generation*, before any deck exists.
    #
    # It used to run against a freshly-created deck, which meant tapping Create
    # put an empty deck in the grid immediately and filled it in later — visible
    # to the user for the entire length of the card job, and left there forever
    # if the job failed. The deck and its cards are now written in one
    # transaction once the cards are ready, so a deck never exists without them;
    # these columns are what tracks that job in the meantime.
    cards_status: Mapped[GenerationStatus] = mapped_column(
        SAEnum(
            GenerationStatus,
            values_callable=lambda enum: [e.value for e in enum],
            name="generation_status_enum",
            native_enum=True,
        ),
        nullable=False,
        default=GenerationStatus.PENDING,
        server_default=GenerationStatus.PENDING.value,
    )
    cards_celery_task_id: Mapped[Optional[str]] = mapped_column(
        String, nullable=True, index=True
    )
    cards_error: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Touched by every status poll. The stale-generation sweep uses it to
    # terminate jobs whose client vanished without cancelling — an app killed
    # mid-generation would otherwise keep a worker (and the provider's meter)
    # running to completion for a script nobody will ever read.
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    is_deleted: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=false(), index=True
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship()
    deck: Mapped[Optional["Deck"]] = relationship(foreign_keys=[deck_id])
    versions: Mapped[list["ScriptVersion"]] = relationship(
        back_populates="generation",
        cascade="all, delete-orphan",
        order_by="ScriptVersion.position",
    )

    # The user's own source material. Not cascaded: the extracted text is what a
    # revision months from now is grounded in, so it outlives the run that first
    # used it — see Attachment.
    attachments: Mapped[list["Attachment"]] = relationship(
        back_populates="generation",
        order_by="Attachment.id",
    )


class ScriptVersion(Base):
    """
    One version of a generation's script, append-only.

    Every finished run, every AI revision and every manual edit appends a row.
    Nothing here is ever overwritten or pruned: a revision that made the script
    worse is the exact case this table exists for, and `position` ordering is
    what the preview screen's undo/redo arrows step through.
    """

    __tablename__ = "script_versions"
    __table_args__ = (
        Index("ix_script_versions_generation_position", "generation_id", "position"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    generation_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("script_generations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # 1-based, contiguous, assigned server-side. The client uses it as the undo
    # cursor, so it has to be an ordering the client can reason about without
    # comparing timestamps.
    position: Mapped[int] = mapped_column(Integer, nullable=False)

    title: Mapped[str] = mapped_column(String, nullable=False, default="")
    script: Mapped[str] = mapped_column(Text, nullable=False)

    kind: Mapped[ScriptVersionKind] = mapped_column(
        SAEnum(
            ScriptVersionKind,
            values_callable=lambda enum: [e.value for e in enum],
            name="script_version_kind_enum",
            native_enum=True,
        ),
        nullable=False,
    )
    # The revise instruction that produced this version, when kind is REVISED —
    # what lets the history label an entry with what was actually asked for
    # rather than just "version 3".
    instruction: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    generation: Mapped["ScriptGeneration"] = relationship(back_populates="versions")
