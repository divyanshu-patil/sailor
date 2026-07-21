import logging

from celery.exceptions import Retry

from app.core.celery_app import celery_app
from app.db.database import SessionLocal
from app.models.deck_model import Deck
from app.schemas.deck_schema import DeckResponse
from app.services.ai.script_generator import ScriptGenerationError, generate_script
from app.services.realtime.deck_events import publish_deck_event
from app.utils.enums.deck_enums import DeckGenerationStatus

logger = logging.getLogger("celery")


@celery_app.task(bind=True, max_retries=3)
def generate_deck_script(self, deck_id: int) -> None:
    db = SessionLocal()
    try:
        deck = db.query(Deck).filter(Deck.id == deck_id).one_or_none()
        if deck is None:
            logger.warning(f"[deck_task] deck {deck_id} not found, aborting")
            return

        deck.generation_status = DeckGenerationStatus.PROCESSING
        deck.celery_task_id = self.request.id
        db.commit()
        publish_deck_event(deck_id, {"status": "processing"})

        try:
            script_text = generate_script(
                title=deck.title,
                description=deck.description,
                duration_mins=deck.duration_mins,
                audience=deck.audience,
            )
        except ScriptGenerationError as exc:
            if self.request.retries < self.max_retries:
                publish_deck_event(deck_id, {"status": "retrying", "attempt": self.request.retries + 1})
                raise self.retry(exc=exc, countdown=min(60, 2 ** self.request.retries * 5))
            raise

        deck.script = script_text
        deck.generation_status = DeckGenerationStatus.COMPLETED
        deck.generation_error = None
        db.commit()
        db.refresh(deck)

        publish_deck_event(
            deck_id,
            {"status": "completed", "deck": DeckResponse.model_validate(deck).model_dump(mode="json")},
        )

    except Retry:
        raise  # Celery's own retry signal — must NOT be treated as a failure below
    except Exception as exc:
        db.rollback()
        deck = db.query(Deck).filter(Deck.id == deck_id).one_or_none()
        if deck is not None:
            deck.generation_status = DeckGenerationStatus.FAILED
            deck.generation_error = str(exc)[:500]
            db.commit()
        publish_deck_event(deck_id, {"status": "failed", "error": str(exc)[:500]})
    finally:
        db.close()