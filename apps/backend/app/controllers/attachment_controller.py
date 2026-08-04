import logging

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.attachment_model import Attachment
from app.models.user_model import User
from app.services.attachments.extract import ExtractionError, extract_text
from app.services.storage_service import (
    MAX_TOTAL_BYTES_PER_GENERATION,
    AttachmentStorageError,
    delete_attachment,
    get_attachment_url,
    kind_for_content_type,
    read_upload,
    store_attachment,
)
from app.utils.enums.attachment_enums import AttachmentKind

logger = logging.getLogger("celery")


def serialize_attachment(attachment: Attachment) -> dict:
    """`url` is signed for the app to display, never for a model to fetch — see
    storage_service.read_attachment_image."""
    try:
        url = get_attachment_url(attachment.object_key)
    except AttachmentStorageError as exc:
        # A missing link costs a thumbnail. It does not cost the upload, which
        # already succeeded and is what the generation actually needs.
        logger.warning(f"[attachments] could not sign url for {attachment.id}: {exc}")
        url = None

    return {
        "id": attachment.id,
        "kind": attachment.kind,
        "filename": attachment.filename,
        "content_type": attachment.content_type,
        "size_bytes": attachment.size_bytes,
        "url": url,
        # The app shows "text extracted" against a document so the user can see
        # their PDF actually contributed something before they hit Generate.
        "has_text": bool(attachment.extracted_text),
        "created_at": attachment.created_at,
    }


def _unbound_total_bytes(user: User, db: Session) -> int:
    """Bytes this user has uploaded but not yet submitted with a brief. The cap
    is per generation, and every unbound attachment is a candidate for the next
    one."""
    total = (
        db.query(func.coalesce(func.sum(Attachment.size_bytes), 0))
        .filter(Attachment.user_id == user.id, Attachment.generation_id.is_(None))
        .scalar()
    )
    return int(total or 0)


async def upload_attachment(file: UploadFile, current_user: User, db: Session) -> dict:
    """Store one file and return the reference the brief will carry.

    Uploading is its own step, ahead of the brief, because the wizard's Next
    button waits on it: a file that only uploads when Generate is pressed cannot
    report progress, and the user finds out their 18MB deck was rejected after
    they have finished filling the form.
    """
    try:
        kind = kind_for_content_type(file.content_type)
    except ValueError as exc:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, str(exc)) from exc

    try:
        data = await read_upload(file, kind)
    except ValueError as exc:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, str(exc)) from exc

    if _unbound_total_bytes(current_user, db) + len(data) > MAX_TOTAL_BYTES_PER_GENERATION:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"Attachments come to more than the "
            f"{MAX_TOTAL_BYTES_PER_GENERATION // (1024 * 1024)}MB total limit. "
            f"Remove one and try again.",
        )

    # Extract before storing. A document nothing can be read out of is a failed
    # upload, and failing here leaves no orphaned object behind to clean up.
    extracted: str | None = None
    if kind == AttachmentKind.DOCUMENT:
        try:
            extracted = extract_text(data, file.content_type or "")
        except ExtractionError as exc:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc

    try:
        object_key = store_attachment(data, file.filename, file.content_type or "")
    except AttachmentStorageError as exc:
        logger.error(f"[attachments] upload failed: {exc}")
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Could not store the attachment. Please try again.",
        ) from exc

    attachment = Attachment(
        user_id=current_user.id,
        kind=kind,
        filename=file.filename or "attachment",
        content_type=(file.content_type or "").split(";")[0].strip().lower(),
        size_bytes=len(data),
        object_key=object_key,
        extracted_text=extracted,
    )
    try:
        db.add(attachment)
        db.commit()
        db.refresh(attachment)
    except Exception:
        db.rollback()
        # The row is what makes the object reachable. Without it the object is
        # unreferenced from the moment it is written, so it goes now.
        try:
            delete_attachment(object_key)
        except AttachmentStorageError:
            logger.warning(f"[attachments] leaked object {object_key} after failed insert")
        raise

    return serialize_attachment(attachment)


def get_owned_attachments(
    attachment_ids: list[int], current_user: User, db: Session
) -> list[Attachment]:
    """The attachments a brief named, verified to belong to this user and to be
    unclaimed. Order follows the ids the client sent."""
    if not attachment_ids:
        return []

    rows = (
        db.query(Attachment)
        .filter(
            Attachment.id.in_(attachment_ids),
            Attachment.user_id == current_user.id,
            Attachment.generation_id.is_(None),
        )
        .all()
    )

    by_id = {row.id: row for row in rows}
    missing = [i for i in attachment_ids if i not in by_id]
    if missing:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Some attachments are no longer available. Remove them and try again.",
        )

    return [by_id[i] for i in attachment_ids]


def remove_attachment(attachment_id: int, current_user: User, db: Session) -> None:
    """Delete an attachment the user removed from the form before submitting."""
    attachment = (
        db.query(Attachment)
        .filter(Attachment.id == attachment_id, Attachment.user_id == current_user.id)
        .one_or_none()
    )
    if attachment is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Attachment not found")

    if attachment.generation_id is not None:
        # The extracted text of a submitted attachment is what a later revision
        # is grounded in. Removing it would quietly change what the AI can see.
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This file is already part of a generated script.",
        )

    try:
        delete_attachment(attachment.object_key)
    except AttachmentStorageError as exc:
        logger.warning(f"[attachments] could not remove object for {attachment_id}: {exc}")

    db.delete(attachment)
    db.commit()
