# app/controllers/card_controller.py
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.card_model import Card
from app.models.deck_model import Deck
from app.models.user_model import User
from app.schemas.card_schema import CardCreateParams, CardResponse, CardUpdateParams
from app.services.ai.card_generator import CardGenerationError, split_script_into_segments
from app.services.cards.impact_colors import assign_colors_by_impact
from app.services.realtime.deck_events import read_card_status, write_card_status
from app.tasks.card_tasks import generate_deck_cards
from app.utils.enums.deck_enums import GenerationStatus


def _get_owned_deck(deck_id: int, current_user: User, db: Session) -> Deck:
    deck = (
        db.query(Deck)
        .filter(Deck.id == deck_id, Deck.user_id == current_user.id, Deck.is_deleted == False)  # noqa: E712
        .one_or_none()
    )
    if deck is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found")
    return deck


def list_cards(deck_id: int, current_user: User, db: Session) -> list[Card]:
    deck = _get_owned_deck(deck_id, current_user, db)
    return db.query(Card).filter(Card.deck_id == deck.id).order_by(Card.position).all()


def request_card_generation(deck_id: int, current_user: User, db: Session) -> dict:
    deck = _get_owned_deck(deck_id, current_user, db)

    if not deck.script:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The deck's script hasn't finished generating yet — cards can only be created once a script exists.",
        )
    if deck.cards_generation_status == GenerationStatus.PROCESSING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Card generation is already in progress for this deck.",
        )

    # Fails fast with a clear message if card_count doesn't fit the script, instead
    # of the async task discovering that deep inside generate_cards() later.
    try:
        split_script_into_segments(deck.script, deck.card_count)
    except CardGenerationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    db.query(Card).filter(Card.deck_id == deck.id).delete()

    deck.cards_generation_status = GenerationStatus.PENDING
    deck.cards_generation_error = None
    db.commit()
    db.refresh(deck)

    # Clear any cached "completed" payload from an earlier run first: the status
    # endpoint reads Redis before Postgres, so a re-generation would otherwise
    # hand the client the previous run's cards on its first poll and stop.
    write_card_status(deck_id, {"status": "pending"})

    task = generate_deck_cards.delay(deck.id, deck.card_count)
    deck.cards_celery_task_id = task.id
    db.commit()
    db.refresh(deck)

    return {
        "deck_id": deck.id,
        "card_count": deck.card_count,
        "cards_generation_status": deck.cards_generation_status.value,
        "cards_generation_error": deck.cards_generation_error,
    }


def get_card_generation_status(deck_id: int, current_user: User, db: Session) -> dict:
    # Same reasoning as the deck guide's get_deck_generation_status: only the
    # columns needed for ownership + the Postgres fallback, since this gets polled
    # every couple seconds and most polls should be answered from Redis alone.
    row = (
        db.query(Deck.id, Deck.cards_generation_status, Deck.cards_generation_error)
        .filter(Deck.id == deck_id, Deck.user_id == current_user.id, Deck.is_deleted == False)  # noqa: E712
        .one_or_none()
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found")

    cached = read_card_status(deck_id)
    if cached is not None:
        return cached

    # Redis cache miss — task hasn't written a first status yet, or the key's TTL
    # expired long after a completed/failed run. Postgres is the fallback either way.
    if row.cards_generation_status == GenerationStatus.COMPLETED:
        cards = db.query(Card).filter(Card.deck_id == deck_id).order_by(Card.position).all()
        return {
            "status": "completed",
            "cards": [CardResponse.model_validate(c).model_dump(mode="json") for c in cards],
        }
    if row.cards_generation_status == GenerationStatus.FAILED:
        return {"status": "failed", "error": row.cards_generation_error}
    return {"status": row.cards_generation_status.value}