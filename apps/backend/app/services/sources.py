"""The user's own material for one generation, in the shape the AI layer wants.

Images are fetched from S3 as bytes; documents were already reduced to text
at upload, so nothing is parsed here. Both generation and revision go through
this, which is what keeps a revision grounded in the same sources the original
script was written from.
"""

import logging

from sqlalchemy.orm import Session

from app.models.attachment_model import Attachment
from app.services.ai.providers.base import ImageInput
from app.services.storage_service import AttachmentStorageError, read_attachment_image
from app.utils.enums.attachment_enums import AttachmentKind

logger = logging.getLogger("celery")


def load_generation_sources(
    generation_id: int, db: Session
) -> tuple[list[ImageInput], str | None]:
    """Returns (images, source_text). Both empty when nothing was attached.

    An image that can't be read is skipped rather than fatal: losing one
    reference photo should cost detail, not the whole script. A document's text
    lives in the row itself, so it cannot fail here at all.
    """
    rows = (
        db.query(Attachment)
        .filter(Attachment.generation_id == generation_id)
        .order_by(Attachment.id)
        .all()
    )
    if not rows:
        return [], None

    images: list[ImageInput] = []
    documents: list[str] = []

    for row in rows:
        if row.kind == AttachmentKind.IMAGE:
            try:
                images.append(read_attachment_image(row.object_key))
            except AttachmentStorageError as exc:
                logger.warning(f"[sources] skipping unreadable image {row.id}: {exc}")
        elif row.extracted_text:
            documents.append(f"### {row.filename}\n\n{row.extracted_text}")

    return images, "\n\n".join(documents) or None
