import io
import logging
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile
from minio.error import S3Error

from app.core.minio_client import client
from app.services.ai.providers.base import ImageInput

logger = logging.getLogger("celery")

IMAGE_BUCKET = "image-files"


class ImageStorageError(Exception):
    """The temporary image could not be stored, fetched, or deleted."""


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
