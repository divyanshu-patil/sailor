import json
import logging

import redis

from app.config.settings import settings

logger = logging.getLogger("celery")

# Long enough to survive a slow/backgrounded poller, short enough not to leak
# keys forever for decks nobody ever checks again.
STATUS_TTL_SECONDS = 60 * 60

_redis_client: redis.Redis | None = None


def _get_redis() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis_client


def write_deck_status(deck_id: int, payload: dict) -> None:
    """Called by the Celery task on every status change. This — not pub/sub —
    is what the polling endpoint actually reads. Failures here are logged and
    swallowed rather than raised: Postgres is already the source of truth by
    the time this is called (see deck_tasks.py — DB commit always happens
    first), so a Redis blip should degrade polling to the DB fallback, not
    crash script generation."""
    try:
        _get_redis().set(f"deck:{deck_id}:status", json.dumps(payload), ex=STATUS_TTL_SECONDS)
    except redis.RedisError as e:
        logger.warning(f"[deck_events] failed to write status to Redis for deck {deck_id}: {e}")


def read_deck_status(deck_id: int) -> dict | None:
    """Returns None on a cache miss OR a Redis error — both cases mean
    'fall back to Postgres', so the caller doesn't need to tell them apart."""
    try:
        raw = _get_redis().get(f"deck:{deck_id}:status")
    except redis.RedisError as e:
        logger.warning(f"[deck_events] failed to read status from Redis for deck {deck_id}: {e}")
        return None
    return json.loads(raw) if raw is not None else None


def write_card_status(deck_id: int, payload: dict) -> None:
    try:
        _get_redis().set(f"deck:{deck_id}:cards:status", json.dumps(payload), ex=STATUS_TTL_SECONDS)
    except redis.RedisError as e:
        logger.warning(f"[deck_events] failed to write card status to Redis for deck {deck_id}: {e}")


def read_card_status(deck_id: int) -> dict | None:
    try:
        raw = _get_redis().get(f"deck:{deck_id}:cards:status")
    except redis.RedisError as e:
        logger.warning(f"[deck_events] failed to read card status from Redis for deck {deck_id}: {e}")
        return None
    return json.loads(raw) if raw is not None else None