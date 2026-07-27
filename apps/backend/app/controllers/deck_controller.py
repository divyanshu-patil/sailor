import random

from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.deck_model import Deck
from app.models.user_model import User
from app.schemas.deck_schema import (
    DeckCreateRequest,
    DeckResponse,
    DeckReviseRequest,
    DeckUpdateRequest,
)
from app.tasks.deck_tasks import generate_deck_script, revise_deck_script
from app.services.realtime.deck_events import read_deck_status, write_deck_status

from app.utils.enums.deck_enums import GenerationStatus

DEFAULT_COLORS = ["#FF5733", "#33A1FF", "#8E44AD", "#2ECC71", "#F1C40F"]


def create_deck(payload: DeckCreateRequest, current_user: User, db: Session) -> Deck:
    deck = Deck(
        user_id=current_user.id,
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


def update_deck(
    deck_id: int, payload: DeckUpdateRequest, current_user: User, db: Session
) -> Deck:
    """Manual edits only — no AI involved, so this is synchronous."""
    deck = get_deck(deck_id, current_user, db)

    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        return deck

    if "script" in changes and deck.generation_status in (
        GenerationStatus.PENDING,
        GenerationStatus.PROCESSING,
    ):
        # The Celery job is about to write this same column; letting the edit
        # through would either be clobbered by the worker or blow up on the
        # version_id_col check with an opaque StaleDataError.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The script is still generating — wait for it to finish before editing it.",
        )

    for field, value in changes.items():
        setattr(deck, field, value)

    db.commit()
    db.refresh(deck)

    # The status endpoint answers from Redis first, so a stale cached payload
    # would keep serving the pre-edit script until the TTL expired.
    if deck.generation_status == GenerationStatus.COMPLETED:
        write_deck_status(
            deck_id,
            {"status": "completed", "deck": DeckResponse.model_validate(deck).model_dump(mode="json")},
        )

    return deck


def request_script_revision(
    deck_id: int, payload: DeckReviseRequest, current_user: User, db: Session
) -> Deck:
    """AI revision — async, same status lifecycle as the initial generation, so
    the client polls /decks/{id}/status for both."""
    deck = get_deck(deck_id, current_user, db)

    if not deck.script:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="There's no script to revise yet — wait for generation to finish.",
        )
    if deck.generation_status in (GenerationStatus.PENDING, GenerationStatus.PROCESSING):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This script is already being generated or revised.",
        )

    deck.generation_status = GenerationStatus.PENDING
    deck.generation_error = None
    db.commit()
    db.refresh(deck)

    # Overwrite the cached "completed" payload immediately: without this the
    # client's first poll after kicking off a revision would read the finished
    # pre-revision deck out of Redis and stop polling.
    write_deck_status(deck_id, {"status": "pending"})

    task = revise_deck_script.delay(deck.id, payload.instruction)
    deck.celery_task_id = task.id
    db.commit()
    db.refresh(deck)

    return deck


def list_decks(current_user: User, db: Session) -> list[Deck]:
    return (
        db.query(Deck)
        .filter(Deck.user_id == current_user.id)
        .order_by(Deck.created_at.desc())
        .all()
    )


def get_deck_generation_status(deck_id: int, current_user: User, db: Session) -> dict:
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