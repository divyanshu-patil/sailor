import json
import redis

from app.config.settings import settings

_redis_client: redis.Redis | None = None


def _get_redis() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.Redis.from_url(settings.REDIS_URL)
    return _redis_client


def publish_deck_event(deck_id: int, payload: dict) -> None:
    """Publish a progress event for a deck. Anyone subscribed to this deck's
    channel (i.e. FastAPI instances holding an open WebSocket for it) receives it."""
    channel = f"deck:{deck_id}:events"
    _get_redis().publish(channel, json.dumps(payload))