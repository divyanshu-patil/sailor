from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from celery.result import AsyncResult
from app.core.celery_app import celery_app
from app.models.deck_model import Deck
from app.models.user_model import User
from app.schemas.deck_schema import DeckCreateRequest, DeckReviseRequest, DeckEditRequest
from app.tasks.deck_tasks import generate_deck_script, revise_deck_script, generate_deck_cards
from app.utils.enums.deck_enums import DeckGenerationStatus
import random

DEFAULT_COLORS = ["#FF5733", "#33A1FF", "#8E44AD", "#2ECC71", "#F1C40F"]


def create_deck(payload: DeckCreateRequest, current_user: User, db: Session) -> Deck:
    deck = Deck(
        user_id=current_user.id,
        # Title is AI-generated from the description during script
        # generation — see generate_deck_script, which overwrites this once
        # the script comes back. Placeholder here just satisfies NOT NULL.
        title=payload.title or "Untitled Presentation",
        description=payload.description,
        card_count=payload.card_count,
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


def _require_status(deck: Deck, *allowed: DeckGenerationStatus) -> None:
    if deck.generation_status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot perform this action while status is {deck.generation_status.value}",
        )


def revise_deck(deck_id: int, payload: DeckReviseRequest, current_user: User, db: Session) -> Deck:
    deck = get_deck(deck_id, current_user, db)
    _require_status(deck, DeckGenerationStatus.SCRIPT_READY)

    task = revise_deck_script.delay(deck.id, payload.instruction)
    deck.celery_task_id = task.id
    db.commit()
    db.refresh(deck)
    return deck


def edit_deck_script(deck_id: int, payload: DeckEditRequest, current_user: User, db: Session) -> Deck:
    deck = get_deck(deck_id, current_user, db)
    _require_status(deck, DeckGenerationStatus.SCRIPT_READY)

    deck.script = payload.script
    db.commit()
    db.refresh(deck)
    return deck


def confirm_deck(deck_id: int, current_user: User, db: Session) -> Deck:
    deck = get_deck(deck_id, current_user, db)
    _require_status(deck, DeckGenerationStatus.SCRIPT_READY)

    task = generate_deck_cards.delay(deck.id)
    deck.celery_task_id = task.id
    db.commit()
    db.refresh(deck)
    return deck


def cancel_deck_generation(deck_id: int, current_user: User, db: Session) -> Deck:
    deck = get_deck(deck_id, current_user, db)
    if not deck.generation_status.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Nothing to cancel — status is {deck.generation_status.value}",
        )

    if deck.celery_task_id:
        celery_app.control.revoke(deck.celery_task_id, terminate=True)

    deck.generation_status = DeckGenerationStatus.CANCELLED
    db.commit()
    db.refresh(deck)
    return deck