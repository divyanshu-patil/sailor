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
