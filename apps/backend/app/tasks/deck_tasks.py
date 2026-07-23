import logging

from celery.exceptions import Retry

from app.core.celery_app import celery_app
from app.db.database import SessionLocal
from app.models.deck_model import Deck
from app.schemas.deck_schema import DeckResponse
from app.services.ai.script_generator import ScriptGenerationError, generate_script, revise_script
from app.services.ai.card_generator import generate_cards, CardGenerationError
from app.services.realtime.deck_events import publish_deck_event
from app.utils.enums.deck_enums import DeckGenerationStatus

logger = logging.getLogger("celery")


def _serialize(deck: Deck) -> dict:
    return DeckResponse.model_validate(deck).model_dump(mode="json")


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
        publish_deck_event(deck_id, {"status": DeckGenerationStatus.PROCESSING.value})

        try:
            script_text = generate_script(
                title=deck.title,
                description=deck.description,
                duration_mins=deck.duration_mins,
                audience=deck.audience,
            )
        except ScriptGenerationError as exc:
            if self.request.retries < self.max_retries:
                publish_deck_event(
                    deck_id, {"status": "retrying", "attempt": self.request.retries + 1}
                )
                raise self.retry(exc=exc, countdown=min(60, 2 ** self.request.retries * 5))
            raise

        # generate_script returns a plain str — no AI-generated title here.
        # deck.title stays whatever deck_controller.create_deck set it to
        # (user-supplied, or the "Untitled Presentation" placeholder).
        # If you want an AI title, that needs a separate call/prompt —
        # flag if you want that added as its own step.
        deck.script = script_text
        deck.generation_status = DeckGenerationStatus.SCRIPT_READY
        deck.generation_error = None
        db.commit()
        db.refresh(deck)

        publish_deck_event(
            deck_id,
            {"status": DeckGenerationStatus.SCRIPT_READY.value, "deck": _serialize(deck)},
        )

    except Retry:
        raise
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


@celery_app.task(bind=True, max_retries=2)
def revise_deck_script(self, deck_id: int, instruction: str) -> None:
    db = SessionLocal()
    try:
        deck = db.query(Deck).filter(Deck.id == deck_id).one_or_none()
        if deck is None:
            logger.warning(f"[deck_task] deck {deck_id} not found, aborting revise")
            return

        deck.generation_status = DeckGenerationStatus.REVISING
        deck.celery_task_id = self.request.id
        db.commit()
        publish_deck_event(deck_id, {"status": DeckGenerationStatus.REVISING.value})

        try:
            revised_script = revise_script(current_script=deck.script, instruction=instruction)
        except ScriptGenerationError as exc:
            if self.request.retries < self.max_retries:
                raise self.retry(exc=exc, countdown=min(30, 2 ** self.request.retries * 5))
            raise

        deck.script = revised_script
        deck.generation_status = DeckGenerationStatus.SCRIPT_READY
        deck.generation_error = None
        db.commit()
        db.refresh(deck)

        publish_deck_event(
            deck_id,
            {"status": DeckGenerationStatus.SCRIPT_READY.value, "deck": _serialize(deck)},
        )

    except Retry:
        raise
    except Exception as exc:
        db.rollback()
        deck = db.query(Deck).filter(Deck.id == deck_id).one_or_none()
        if deck is not None:
            deck.generation_status = DeckGenerationStatus.SCRIPT_READY
            deck.generation_error = str(exc)[:500]
            db.commit()
        publish_deck_event(deck_id, {"status": "revise_failed", "error": str(exc)[:500]})
    finally:
        db.close()


@celery_app.task(bind=True, max_retries=3)
def generate_deck_cards(self, deck_id: int) -> None:
    db = SessionLocal()
    try:
        deck = db.query(Deck).filter(Deck.id == deck_id).one_or_none()
        if deck is None:
            logger.warning(f"[deck_task] deck {deck_id} not found, aborting card gen")
            return

        deck.generation_status = DeckGenerationStatus.GENERATING_CARDS
        deck.celery_task_id = self.request.id
        db.commit()
        publish_deck_event(deck_id, {"status": DeckGenerationStatus.GENERATING_CARDS.value})

        try:
            generate_cards(deck_id=deck.id, script=deck.script, card_count=deck.card_count)
        except CardGenerationError as exc:
            if self.request.retries < self.max_retries:
                raise self.retry(exc=exc, countdown=min(60, 2 ** self.request.retries * 5))
            raise

        deck.generation_status = DeckGenerationStatus.COMPLETED
        deck.generation_error = None
        db.commit()
        db.refresh(deck)

        publish_deck_event(
            deck_id,
            {"status": DeckGenerationStatus.COMPLETED.value, "deck": _serialize(deck)},
        )

    except Retry:
        raise
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