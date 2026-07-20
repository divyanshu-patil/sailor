import random

from sqlalchemy.orm import Session

from app.models.deck_model import Deck
from app.models.user_model import User
from app.schemas.deck_schema import DeckCreateRequest
from app.tasks.deck_tasks import generate_deck_script

from app.utils.enums.deck_enums import DeckGenerationStatus

DEFAULT_COLORS = ["#FF5733", "#33A1FF", "#8E44AD", "#2ECC71", "#F1C40F"]


def create_deck(payload: DeckCreateRequest, current_user: User, db: Session) -> Deck:
    deck = Deck(
        user_id=current_user.id,
        title=payload.title,
        description=payload.description,
        color=random.choice(DEFAULT_COLORS),
        duration_mins=payload.duration_mins,
        generation_status=DeckGenerationStatus.PENDING,
        audience=payload.audience,
    )
    db.add(deck)
    db.commit()
    db.refresh(deck)

    task = generate_deck_script.delay(deck.id)
    deck.celery_task_id = task.id
    db.commit()
    db.refresh(deck)

    return deck