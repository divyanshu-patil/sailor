import logging

from celery.exceptions import Retry

from app.core.celery_app import celery_app
from app.db.database import SessionLocal
from app.models.deck_model import Deck
from app.schemas.deck_schema import DeckResponse
from app.services.ai.script_generator import (
    ScriptGenerationError,
    generate_script,
    revise_script,
)
from app.services.realtime.deck_events import write_deck_status
from app.utils.enums.deck_enums import GenerationStatus

logger = logging.getLogger("celery")


@celery_app.task(bind=True, max_retries=3)
def generate_deck_script(self, deck_id: int) -> None:
    db = SessionLocal()
    try:
        deck = db.query(Deck).filter(Deck.id == deck_id).one_or_none()
        if deck is None:
            logger.warning(f"[deck_task] deck {deck_id} not found, aborting")
            return

        deck.generation_status = GenerationStatus.PROCESSING
        deck.celery_task_id = self.request.id
        db.commit()
        write_deck_status(deck_id, {"status": "processing"})

        try:
            generated_title, script_text = generate_script(
                description=deck.description,
                duration_mins=deck.duration_mins,
                audience=deck.audience,
            )
        except ScriptGenerationError as exc:
            if self.request.retries < self.max_retries:
                write_deck_status(deck_id, {"status": "retrying", "attempt": self.request.retries + 1})
                raise self.retry(exc=exc, countdown=min(60, 2 ** self.request.retries * 5))
            raise

        deck.title = generated_title
        deck.script = script_text
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
        db.rollback()
        deck = db.query(Deck).filter(Deck.id == deck_id).one_or_none()
        if deck is not None:
            deck.generation_status = GenerationStatus.FAILED
            deck.generation_error = str(exc)[:500]
            db.commit()
        write_deck_status(deck_id, {"status": "failed", "error": str(exc)[:500]})
    finally:
        db.close()


@celery_app.task(bind=True, max_retries=3)
def revise_deck_script(self, deck_id: int, instruction: str) -> None:
    """Rewrites an existing script from a presenter instruction. Reuses the
    deck's own generation_status/celery_task_id columns and the same Redis key
    as generate_deck_script, so the app polls one status endpoint for both —
    from the client's point of view a revision is just the script generating
    again."""
    db = SessionLocal()
    original_script: str | None = None
    try:
        deck = db.query(Deck).filter(Deck.id == deck_id).one_or_none()
        if deck is None:
            logger.warning(f"[deck_task] deck {deck_id} not found, aborting revision")
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
        if deck is not None:
            deck.script = original_script
            deck.generation_status = GenerationStatus.FAILED
            deck.generation_error = str(exc)[:500]
            db.commit()
        write_deck_status(deck_id, {"status": "failed", "error": str(exc)[:500]})
    finally:
        db.close()