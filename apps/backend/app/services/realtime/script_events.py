"""Redis-backed status cache for script generations.

Same contract as deck_events: the Celery task writes on every status change, the
polling endpoint reads this before touching Postgres, and every failure here is
logged and swallowed because the DB commit has already happened by the time it's
called. Kept in its own module rather than folded into deck_events so the key
namespace can't collide — a generation id and a deck id are both small integers
from independent sequences, and `script:7` and `deck:7` are different things.
"""

import json
import logging

import redis

from app.services.realtime.deck_events import STATUS_TTL_SECONDS, _get_redis

logger = logging.getLogger("celery")

# This mapping is intentionally separate from the status cache. Status may be
# overwritten many times by a worker, while the image key must stay stable from
# enqueue through the final cleanup. One hour comfortably covers the task time
# limit and its retries without leaving a permanent Redis entry.
IMAGE_TTL_SECONDS = 60 * 60


class ImageReferenceCacheError(RuntimeError):
    """Redis could not reliably carry a generation's temporary image key."""


def _key(generation_id: int) -> str:
    return f"script:{generation_id}:status"


def write_script_status(generation_id: int, payload: dict) -> None:
    try:
        _get_redis().set(_key(generation_id), json.dumps(payload), ex=STATUS_TTL_SECONDS)
    except redis.RedisError as e:
        logger.warning(
            f"[script_events] failed to write status for generation {generation_id}: {e}"
        )


def read_script_status(generation_id: int) -> dict | None:
    """None means 'fall back to Postgres' — cache miss and Redis error are the
    same answer to the caller."""
    try:
        raw = _get_redis().get(_key(generation_id))
    except redis.RedisError as e:
        logger.warning(
            f"[script_events] failed to read status for generation {generation_id}: {e}"
        )
        return None
    return json.loads(raw) if raw is not None else None


def _cards_key(generation_id: int) -> str:
    return f"script:{generation_id}:cards:status"


def _image_key(generation_id: int) -> str:
    return f"script:{generation_id}:image"


def write_generation_image_key(generation_id: int, object_name: str) -> None:
    """Associate a queued generation with its temporary MinIO object.

    This is part of enqueueing, not a best-effort status update. If it fails the
    caller must not dispatch the task, otherwise the worker would silently
    generate a script without the image the user supplied.
    """
    try:
        _get_redis().set(_image_key(generation_id), object_name, ex=IMAGE_TTL_SECONDS)
    except redis.RedisError as exc:
        raise ImageReferenceCacheError(
            f"failed to cache image key for generation {generation_id}"
        ) from exc


def read_generation_image_key(generation_id: int) -> str | None:
    """Return the MinIO key for an image-backed generation, if it has one."""
    try:
        return _get_redis().get(_image_key(generation_id))
    except redis.RedisError as exc:
        raise ImageReferenceCacheError(
            f"failed to read image key for generation {generation_id}"
        ) from exc


def clear_generation_image_key(generation_id: int) -> None:
    """Forget a key only after its matching MinIO object has been removed."""
    try:
        _get_redis().delete(_image_key(generation_id))
    except redis.RedisError as exc:
        # The object is already gone at this point. A TTL bounds the harmless
        # stale pointer, so cleanup must not turn into another failed task.
        logger.warning(
            f"[script_events] failed to clear image key for generation {generation_id}: {exc}"
        )


def write_generation_cards_status(generation_id: int, payload: dict) -> None:
    """Status of the card job that turns an accepted script into a deck. Keyed
    on the generation, not a deck — there is no deck until that job finishes."""
    try:
        _get_redis().set(_cards_key(generation_id), json.dumps(payload), ex=STATUS_TTL_SECONDS)
    except redis.RedisError as e:
        logger.warning(
            f"[script_events] failed to write cards status for generation {generation_id}: {e}"
        )


def read_generation_cards_status(generation_id: int) -> dict | None:
    try:
        raw = _get_redis().get(_cards_key(generation_id))
    except redis.RedisError as e:
        logger.warning(
            f"[script_events] failed to read cards status for generation {generation_id}: {e}"
        )
        return None
    return json.loads(raw) if raw is not None else None


def clear_script_status(generation_id: int) -> None:
    """Used when a generation is discarded, so a stale terminal payload can't be
    served for an id the user has thrown away."""
    try:
        _get_redis().delete(_key(generation_id), _cards_key(generation_id))
    except redis.RedisError as e:
        logger.warning(
            f"[script_events] failed to clear status for generation {generation_id}: {e}"
        )
