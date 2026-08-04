from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.utils.enums.attachment_enums import AttachmentKind

if TYPE_CHECKING:
    from app.models.script_model import ScriptGeneration
    from app.models.user_model import User


class Attachment(Base):
    """
    One file the user uploaded to ground a generation in their own material.

    Uploaded on its own, before any generation exists — the wizard uploads each
    file the moment it is picked so the Next button can wait on real progress
    rather than stalling on Generate. `generation_id` is therefore null until a
    brief is submitted carrying this attachment's id.

    This row replaces the Redis pointer the single-image flow used. That pointer
    existed only because there was nowhere durable to record which object a
    queued generation owned; it had a one-hour TTL, held no extracted text, and
    could only ever describe one file.
    """

    __tablename__ = "attachments"
    __table_args__ = (
        # The worker's lookup: everything this generation was given, in the
        # order the user added it.
        Index("ix_attachments_generation_id", "generation_id", "id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )

    # Null while the file is an orphan the wizard uploaded but never submitted.
    # ON DELETE SET NULL rather than CASCADE: discarding a generation shouldn't
    # silently drop rows the sweeper is responsible for cleaning up.
    generation_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("script_generations.id", ondelete="SET NULL"),
        nullable=True,
    )

    kind: Mapped[AttachmentKind] = mapped_column(String, nullable=False)
    filename: Mapped[str] = mapped_column(String, nullable=False)
    content_type: Mapped[str] = mapped_column(String, nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)

    # The MinIO object key. Opaque and server-generated — a user-supplied
    # filename never reaches a storage path.
    object_key: Mapped[str] = mapped_column(String, nullable=False, unique=True)

    # Documents only, and the reason extraction happens at upload rather than at
    # generation time: a revision months later needs the source material, and
    # re-parsing a PDF on every revise call would mean keeping the original file
    # around forever just to read the same text out of it again.
    extracted_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship()
    generation: Mapped[Optional["ScriptGeneration"]] = relationship(
        back_populates="attachments"
    )

    @property
    def is_image(self) -> bool:
        return self.kind == AttachmentKind.IMAGE
