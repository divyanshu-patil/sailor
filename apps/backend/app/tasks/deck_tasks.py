import logging

from celery.exceptions import Retry

from app.core.celery_app import celery_app
from app.db.database import SessionLocal
from app.models.deck_model import Deck
from app.schemas.deck_schema import DeckResponse
from app.services.ai.script_generator import ScriptGenerationError, revise_script
from app.services.realtime.deck_events import write_deck_status
from app.utils.enums.deck_enums import GenerationStatus

logger = logging.getLogger("celery")

# Initial script generation no longer lives here.
#
# It moved to tasks/script_tasks.py, where it runs against a ScriptGeneration
# rather than a Deck — because a script that's still being written doesn't have
# a deck yet, and shouldn't. What's left is revision of a deck the user already
# created, from the script-detail screen.


@celery_app.task(bind=True, max_retries=3)
def revise_deck_script(self, deck_id: int, instruction: str) -> None:
    """Rewrites an existing deck's script from a presenter instruction. Uses the
    deck's own generation_status/celery_task_id columns and the deck status Redis
    key, so the app polls /decks/{id}/status for it — from the client's point of
    view a revision is just the script generating again."""
    db = SessionLocal()
    original_script: str | None = None
    try:
        deck = db.query(Deck).filter(Deck.id == deck_id).one_or_none()
        if deck is None:
            logger.warning(f"[deck_task] deck {deck_id} not found, aborting revision")
            return

        if deck.generation_status == GenerationStatus.CANCELLED:
            logger.info(f"[deck_task] deck {deck_id} revision cancelled before start, aborting")
            return

        original_script = deck.script
        deck.generation_status = GenerationStatus.PROCESSING
        deck.celery_task_id = self.request.id
        db.commit()
        write_deck_status(deck_id, {"status": "processing"})

        try:
            revised = revise_script(
                script=original_script,
                instruction=instruction,
                title=deck.title or "",
                audience=deck.audience,
            )
        except ScriptGenerationError as exc:
            if self.request.retries < self.max_retries:
                write_deck_status(deck_id, {"status": "retrying", "attempt": self.request.retries + 1})
                raise self.retry(exc=exc, countdown=min(60, 2 ** self.request.retries * 5))
            raise

        deck.script = revised
        deck.generation_status = GenerationStatus.COMPLETED
        deck.generation_error = None
        db.commit()
        db.refresh(deck)

        write_deck_status(
            deck_id,
            {"status": "completed", "deck": DeckResponse.model_validate(deck).model_dump(mode="json")},
        )

    except Retry:
        raise
    except Exception as exc:
        # A failed revision must not destroy the script the user already had —
        # restore it and report the deck as completed-with-error rather than
        # leaving the deck in FAILED with a null-ish script.
        db.rollback()
        deck = db.query(Deck).filter(Deck.id == deck_id).one_or_none()
        if deck is None:
            return
        # The original script still has to be put back on a cancel — the
        # terminated task may have got as far as clearing it — but the status
        # stays CANCELLED rather than becoming FAILED. See the same guard in
        # generate_deck_script.
        was_cancelled = deck.generation_status == GenerationStatus.CANCELLED
        deck.script = original_script
        if not was_cancelled:
            deck.generation_status = GenerationStatus.FAILED
            deck.generation_error = str(exc)[:500]
        db.commit()
        if not was_cancelled:
            write_deck_status(deck_id, {"status": "failed", "error": str(exc)[:500]})
    finally:
        db.close()