import logging
from datetime import timedelta
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile
from botocore.exceptions import BotoCoreError, ClientError

from app.core.s3_client import BUCKET, client
from app.services.ai.providers.base import ImageInput
from app.services.attachments.extract import DOCUMENT_TYPES, IMAGE_TYPES
from app.utils.enums.attachment_enums import AttachmentKind

logger = logging.getLogger("celery")

# Any failure talking to S3: an error response, or no response at all.
S3Error = (ClientError, BotoCoreError)

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
    """Keep user-supplied filenames out of S3 object keys."""
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
    """Put one attachment in S3 and return its opaque object key."""
    object_name = _object_name(filename)
    try:
        client.put_object(
            Bucket=BUCKET,
            Key=object_name,
            Body=data,
            ContentType=content_type,
        )
    except S3Error as exc:
        raise AttachmentStorageError("Could not store the attachment.") from exc
    return object_name


def read_attachment_image(object_name: str) -> ImageInput:
    """Load an image attachment into the provider-neutral vision input.

    The worker reads the bytes and base64s them into the request rather than
    handing the provider a presigned URL: Ollama and Gemini take bytes
    regardless, and a URL would leak a week-long link to a third party. The
    presigned URL is for the app, not for the model.
    """
    try:
        response = client.get_object(Bucket=BUCKET, Key=object_name)
        with response["Body"] as body:
            contents = body.read()
    except S3Error as exc:
        raise AttachmentStorageError("Could not load the attachment.") from exc

    if not contents:
        raise AttachmentStorageError("The stored attachment is empty.")

    return ImageInput(
        data=contents, media_type=response.get("ContentType") or "application/octet-stream"
    )


def get_attachment_url(object_name: str, expires: timedelta = timedelta(days=7)) -> str:
    """A URL the *app* can show."""
    try:
        return client.generate_presigned_url(
            "get_object",
            Params={"Bucket": BUCKET, "Key": object_name},
            ExpiresIn=int(expires.total_seconds()),
        )
    except S3Error as exc:
        raise AttachmentStorageError("Could not create a link for the attachment.") from exc


def delete_attachment(object_name: str) -> None:
    try:
        client.delete_object(Bucket=BUCKET, Key=object_name)
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
            Bucket=BUCKET,
            Key=object_name,
            Body=contents,
            ContentType=file.content_type,
        )
    except S3Error as exc:
        raise AudioStorageError("Could not store the audio recording.") from exc

    return object_name


def get_deck_audio_url(object_name: str, expires: timedelta = timedelta(days=7)) -> str:
    """Presigned GET URL the app downloads and caches from, bypassing the backend.
    7 days is the SigV4 maximum."""
    try:
        return client.generate_presigned_url(
            "get_object",
            Params={"Bucket": BUCKET, "Key": object_name},
            ExpiresIn=int(expires.total_seconds()),
        )
    except S3Error as exc:
        raise AudioStorageError("Could not create a playback link for the recording.") from exc


def delete_deck_audio(object_name: str) -> None:
    """Remove a deck's recording — used when the deck itself is deleted, not on
    a normal re-record (which overwrites the same key instead)."""
    try:
        client.delete_object(Bucket=BUCKET, Key=object_name)
    except S3Error as exc:
        raise AudioStorageError("Could not remove the audio recording.") from exc
