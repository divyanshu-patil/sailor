import io
import logging
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile
from minio.error import S3Error

from app.core.minio_client import client
from app.services.ai.providers.base import ImageInput

from datetime import timedelta

from app.core.minio_client import client

logger = logging.getLogger("celery")

IMAGE_BUCKET = "image-files"
AUDIO_BUCKET = "deck-audio"


class ImageStorageError(Exception):
    """The temporary image could not be stored, fetched, or deleted."""

class AudioStorageError(Exception):
    """The deck's audio recording could not be stored, signed, or removed."""


def _object_name(file: UploadFile) -> str:
    """Keep user-supplied filenames out of MinIO object paths."""
    suffix = Path(file.filename or "").suffix.lower()
    return f"generations/{uuid4()}{suffix}"


async def upload_image(file: UploadFile) -> str:
    """Store one request image and return the opaque MinIO object key."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise ValueError("The attachment must be an image.")

    contents = await file.read()
    if not contents:
        raise ValueError("The image attachment is empty.")

    object_name = _object_name(file)

    try:
        client.put_object(
            bucket_name=IMAGE_BUCKET,
            object_name=object_name,
            data=io.BytesIO(contents),
            length=len(contents),
            content_type=file.content_type,
        )
    except S3Error as exc:
        raise ImageStorageError("Could not store the reference image.") from exc

    return object_name


def read_image(object_name: str) -> ImageInput:
    """Load a temporary MinIO object into the provider-neutral vision input."""
    response = None
    try:
        metadata = client.stat_object(IMAGE_BUCKET, object_name)
        response = client.get_object(IMAGE_BUCKET, object_name)
        contents = response.read()
    except S3Error as exc:
        raise ImageStorageError("Could not load the reference image.") from exc
    finally:
        if response is not None:
            response.close()
            response.release_conn()

    if not contents:
        raise ImageStorageError("The stored reference image is empty.")

    content_type = metadata.content_type or "application/octet-stream"
    return ImageInput(data=contents, media_type=content_type)


def delete_image(object_name: str) -> None:
    """Remove a temporary generation image after its job reaches an endpoint."""
    try:
        client.remove_object(IMAGE_BUCKET, object_name)
    except S3Error as exc:
        raise ImageStorageError("Could not remove the reference image.") from exc



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
    """Presigned GET URL a client can play directly, bypassing the backend.
    Signed with `client`, not `client` — see the endpoint-split
    section below for why those need to be two different instances."""
    try:
        return client.presigned_get_object(AUDIO_BUCKET, object_name, expires=expires)
    except S3Error as exc:
        raise AudioStorageError("Could not create a playback link for the recording.") from exc


def delete_deck_audio(object_name: str) -> None:
    """Remove a deck's recording — used when the deck itself is deleted, not on
    a normal re-record (which overwrites the same key instead)."""
    try:
        client.remove_object(AUDIO_BUCKET, object_name)
    except S3Error as exc:
        raise AudioStorageError("Could not remove the audio recording.") from exc