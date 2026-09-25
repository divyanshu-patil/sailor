import logging
from decimal import Decimal

from celery.exceptions import Retry

from app.core.celery_app import celery_app
from app.db.database import SessionLocal
from app.models.card_model import Card
from app.models.deck_model import Deck
from app.schemas.card_schema import CardResponse
from app.services.ai.card_generator import CardGenerationError, generate_cards
from app.services.cards.impact_colors import assign_colors_by_impact
from app.services.realtime.deck_events import write_card_status
from app.utils.enums.deck_enums import GenerationStatus
from app.utils.enums.speaking_style import SpeakingStyle

logger = logging.getLogger("celery")


@celery_app.task(bind=True, max_retries=3)
def generate_deck_cards(self, deck_id: int, card_count: int) -> None:
    db = SessionLocal()
    try:
        deck = db.query(Deck).filter(Deck.id == deck_id).one_or_none()
        if deck is None:
            logger.warning(f"[card_task] deck {deck_id} not found, aborting")
            return

        deck.cards_generation_status = GenerationStatus.PROCESSING
        deck.cards_celery_task_id = self.request.id
        db.commit()
        write_card_status(deck_id, {"status": "processing"})

        try:
            card_data = generate_cards(script=deck.script, card_count=card_count)
        except CardGenerationError as exc:
            if self.request.retries < self.max_retries:
                write_card_status(deck_id, {"status": "retrying", "attempt": self.request.retries + 1})
                raise self.retry(exc=exc, countdown=min(60, 2 ** self.request.retries * 5))
            raise

        db.query(Card).filter(Card.deck_id == deck.id).delete()
        db.flush()

        new_cards = [
            Card(
                deck_id=deck.id,
                position=i + 1,
                title=item["title"],
                description=item["description"],
                keywords=item["keywords"],
                impact=Decimal(str(item["impact"])),
                delivery=SpeakingStyle(item["delivery"]),
                color="#CCCCCC",  # placeholder
            )
            for i, item in enumerate(card_data)
        ]

        db.add_all(new_cards)
        db.flush()  # assigns ids; needed before coloring even though we don't use the ids here

        assign_colors_by_impact(new_cards)
        deck.card_count = len(new_cards)
        deck.cards_generation_status = GenerationStatus.COMPLETED
        deck.cards_generation_error = None
        db.commit()
        for card in new_cards:
            db.refresh(card)

        write_card_status(
            deck_id,
            {
                "status": "completed",
                "cards": [CardResponse.model_validate(c).model_dump(mode="json") for c in new_cards],
            },
        )

    except Retry:
        raise  # Celery's own retry signal — not a real failure
    except Exception as exc:
        db.rollback()
        deck = db.query(Deck).filter(Deck.id == deck_id).one_or_none()
        if deck is not None:
            deck.cards_generation_status = GenerationStatus.FAILED
            deck.cards_generation_error = str(exc)[:500]
            db.commit()
        write_card_status(deck_id, {"status": "failed", "error": str(exc)[:500]})
    finally:
        db.close()
