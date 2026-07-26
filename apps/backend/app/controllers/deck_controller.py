import random

from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.deck_model import Deck
from app.models.user_model import User
from app.schemas.deck_schema import DeckCreateRequest, DeckResponse
from app.tasks.deck_tasks import generate_deck_script
from app.services.realtime.deck_events import read_deck_status

from app.utils.enums.deck_enums import GenerationStatus

DEFAULT_COLORS = ["#FF5733", "#33A1FF", "#8E44AD", "#2ECC71", "#F1C40F"]


def create_deck(payload: DeckCreateRequest, current_user: User, db: Session) -> Deck:
    deck = Deck(
        user_id=current_user.id,
        title=payload.title,
        description=payload.description,
        card_count=payload.card_count,
        color=random.choice(DEFAULT_COLORS),
        duration_mins=payload.duration_mins,
        generation_status=GenerationStatus.PENDING,
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


def get_deck(deck_id: int, current_user: User, db: Session) -> Deck:
    deck = db.query(Deck).filter(Deck.id == deck_id, Deck.user_id == current_user.id).one_or_none()
    if deck is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found")
    return deck


def list_decks(current_user: User, db: Session) -> list[Deck]:
    return (
        db.query(Deck)
        .filter(Deck.user_id == current_user.id)
        .order_by(Deck.created_at.desc())
        .all()
    )


def get_deck_generation_status(deck_id: int, current_user: User, db: Session) -> dict:
    # Only the columns needed for the ownership check + the Postgres fallback —
    # not a full Deck row. This endpoint gets hit every couple seconds while a
    # script is generating; no reason to pull the (potentially large) `script`
    # text column on every poll when the Redis fast-path usually means we
    # never touch it at all.
    row = (
        db.query(Deck.id, Deck.generation_status, Deck.generation_error)
        .filter(Deck.id == deck_id, Deck.user_id == current_user.id, Deck.is_deleted == False)  # noqa: E712
        .one_or_none()
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found")

    cached = read_deck_status(deck_id)
    if cached is not None:
        return cached

    # Redis cache miss — either the task hasn't written its first status yet
    # (deck is still PENDING), or the key's TTL expired long after a
    # completed/failed run. Postgres is the fallback source of truth either way.
    if row.generation_status == GenerationStatus.COMPLETED:
        deck = db.query(Deck).filter(Deck.id == deck_id).one()
        return {"status": "completed", "deck": DeckResponse.model_validate(deck).model_dump(mode="json")}
    if row.generation_status == GenerationStatus.FAILED:
        return {"status": "failed", "error": row.generation_error}
    return {"status": row.generation_status.value}