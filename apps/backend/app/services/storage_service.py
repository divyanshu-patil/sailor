import io
import logging
from datetime import timedelta
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile
from minio.error import S3Error

from app.core.minio_client import client, public_client
from app.services.ai.providers.base import ImageInput
from app.services.attachments.extract import DOCUMENT_TYPES, IMAGE_TYPES
from app.utils.enums.attachment_enums import AttachmentKind

logger = logging.getLogger("celery")

ATTACHMENT_BUCKET = "attachments"
AUDIO_BUCKET = "deck-audio"

# Caps, enforced here as well as in the app. The client checks first so the user
# is told before a slow upload rather than after it, but the client is not a
# trust boundary — a request that skips it still has to pass this.
MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_DOCUMENT_BYTES = 20 * 1024 * 1024
MAX_TOTAL_BYTES_PER_GENERATION = 50 * 1024 * 1024


class AttachmentStorageError(Exception):
    """An attachment could not be stored, fetched, or deleted."""


class AudioStorageError(Exception):
    """The deck's audio recording could not be stored, signed, or removed."""


def kind_for_content_type(content_type: str | None) -> AttachmentKind:
    """Classify an upload, or reject it. This is the whitelist — anything not
    named here never reaches storage."""
    normalized = (content_type or "").split(";")[0].strip().lower()
    if normalized in IMAGE_TYPES:
        return AttachmentKind.IMAGE
    if normalized in DOCUMENT_TYPES:
        return AttachmentKind.DOCUMENT
    raise ValueError(
        "Attach a JPEG or PNG image, or a PDF, Word, PowerPoint, or text document."
    )


def max_bytes_for(kind: AttachmentKind) -> int:
    return MAX_IMAGE_BYTES if kind == AttachmentKind.IMAGE else MAX_DOCUMENT_BYTES


def _object_name(filename: str | None) -> str:
    """Keep user-supplied filenames out of MinIO object paths."""
    suffix = Path(filename or "").suffix.lower()
    return f"uploads/{uuid4()}{suffix}"


async def read_upload(file: UploadFile, kind: AttachmentKind) -> bytes:
    """Read an upload into memory, enforcing its size cap.

    Read in chunks and abandoned the moment the cap is passed, so a client that
    lies about Content-Length can't make the server buffer an arbitrary file just
    to discover how big it is.
    """
    limit = max_bytes_for(kind)
    chunks: list[bytes] = []
    total = 0

    while chunk := await file.read(1024 * 1024):
        total += len(chunk)
        if total > limit:
            raise ValueError(
                f"This file is larger than the {limit // (1024 * 1024)}MB limit."
            )
        chunks.append(chunk)

    if total == 0:
        raise ValueError("This file is empty.")

    return b"".join(chunks)


def store_attachment(data: bytes, filename: str | None, content_type: str) -> str:
    """Put one attachment in MinIO and return its opaque object key."""
    object_name = _object_name(filename)
    try:
        client.put_object(
            bucket_name=ATTACHMENT_BUCKET,
            object_name=object_name,
            data=io.BytesIO(data),
            length=len(data),
            content_type=content_type,
        )
    except S3Error as exc:
        raise AttachmentStorageError("Could not store the attachment.") from exc
    return object_name


def read_attachment_image(object_name: str) -> ImageInput:
    """Load an image attachment into the provider-neutral vision input.

    The worker reads bytes from MinIO over the internal address and base64s them
    into the request. It deliberately does not hand the provider a presigned URL:
    that URL points at this deployment's MinIO, which a cloud provider cannot
    reach, and Ollama and Gemini take bytes regardless. The presigned URL is for
    the app, not for the model.
    """
    response = None
    try:
        metadata = client.stat_object(ATTACHMENT_BUCKET, object_name)
        response = client.get_object(ATTACHMENT_BUCKET, object_name)
        contents = response.read()
    except S3Error as exc:
        raise AttachmentStorageError("Could not load the attachment.") from exc
    finally:
        if response is not None:
            response.close()
            response.release_conn()

    if not contents:
        raise AttachmentStorageError("The stored attachment is empty.")

    return ImageInput(
        data=contents, media_type=metadata.content_type or "application/octet-stream"
    )


def get_attachment_url(object_name: str, expires: timedelta = timedelta(days=7)) -> str:
    """A URL the *app* can show. Signed against the public endpoint."""
    try:
        return public_client.presigned_get_object(
            ATTACHMENT_BUCKET, object_name, expires=expires
        )
    except S3Error as exc:
        raise AttachmentStorageError("Could not create a link for the attachment.") from exc


def delete_attachment(object_name: str) -> None:
    try:
        client.remove_object(ATTACHMENT_BUCKET, object_name)
    except S3Error as exc:
        raise AttachmentStorageError("Could not remove the attachment.") from exc


def _deck_audio_object_name(deck_id: int) -> str:
    """Deterministic — one recording per deck, no extension in the key. A
    re-upload overwrites this same object rather than accumulating orphans,
    and content_type is tracked as object metadata instead of being encoded
    into the key, so a format change between recordings is a non-event."""
    return f"decks/{deck_id}/audio"


async def upload_deck_audio(deck_id: int, file: UploadFile) -> str:
    """Store (or overwrite) the recording for one deck and return its object key."""
    if not file.content_type or not file.content_type.startswith("audio/"):
        raise ValueError("The attachment must be an audio file.")

    contents = await file.read()
    if not contents:
        raise ValueError("The audio attachment is empty.")

    object_name = _deck_audio_object_name(deck_id)

    try:
        client.put_object(
            bucket_name=AUDIO_BUCKET,
            object_name=object_name,
            data=io.BytesIO(contents),
            length=len(contents),
            content_type=file.content_type,
        )
    except S3Error as exc:
        raise AudioStorageError("Could not store the audio recording.") from exc

    return object_name


def get_deck_audio_url(object_name: str, expires: timedelta = timedelta(days=7)) -> str:
    """Presigned GET URL the app downloads and caches from, bypassing the backend.

    Signed with `public_client`, not `client`: the signature covers the host, so
    signing with the internal client would hand the phone a valid signature for
    `localhost:9000` — which resolves to the phone. See core/minio_client.
    """
    try:
        return public_client.presigned_get_object(AUDIO_BUCKET, object_name, expires=expires)
    except S3Error as exc:
        raise AudioStorageError("Could not create a playback link for the recording.") from exc


def delete_deck_audio(object_name: str) -> None:
    """Remove a deck's recording — used when the deck itself is deleted, not on
    a normal re-record (which overwrites the same key instead)."""
    try:
        client.remove_object(AUDIO_BUCKET, object_name)
    except S3Error as exc:
        raise AudioStorageError("Could not remove the audio recording.") from exc
