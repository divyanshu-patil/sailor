import logging

from app.utils.enums.deck_enums import AudienceType

logger = logging.getLogger("celery")


class CardGenerationError(Exception):
    """Raised when card generation from a script fails."""


def generate_cards(deck_id: int, script: str, card_count: int) -> None:
    """
    TODO: generate `card_count` Card rows from `script` and persist them
    against `deck_id`. Mirror script_generator.py's pattern: build a prompt
    per card (or one prompt requesting all cards as JSON), call through
    get_ollama_client()/_chat_with_fallback-style retry logic, parse the
    result, and bulk-insert Card rows via a DB session.

    Left unimplemented for now so deck_tasks.generate_deck_cards has a real
    function to import and call — currently just raises so the task fails
    loudly instead of silently no-oping.
    """
    raise CardGenerationError("generate_cards is not implemented yet")