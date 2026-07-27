from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.controllers import deck_controller
from app.db.database import get_db
from app.models.user_model import User
from app.schemas.deck_schema import (
    AllDeckInfoResponse,
    DeckCreateRequest,
    DeckResponse,
    DeckReviseRequest,
    DeckUpdateRequest,
)

router = APIRouter(prefix="/decks", tags=["Decks"])


@router.get("/health")
def get_user_health_check():
    """Simple health check for users — no auth required."""
    return {"status": "ok", "service": "Deck-router"}


@router.post("", response_model=DeckResponse, status_code=status.HTTP_201_CREATED)
def create_deck(
    payload: DeckCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return deck_controller.create_deck(payload, current_user, db)


@router.get("/{deck_id}", response_model=DeckResponse)
def get_deck(
    deck_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return deck_controller.get_deck(deck_id, current_user, db)


@router.patch("/{deck_id}", response_model=DeckResponse)
def update_deck(
    deck_id: int,
    payload: DeckUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Manual edits: the script editor, a rename, the favourite toggle."""
    return deck_controller.update_deck(deck_id, payload, current_user, db)


@router.post("/{deck_id}/revise", response_model=DeckResponse, status_code=status.HTTP_202_ACCEPTED)
def revise_deck_script(
    deck_id: int,
    payload: DeckReviseRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Kicks off an AI rewrite of the existing script. Poll /{deck_id}/status
    for the result, exactly as with the initial generation."""
    return deck_controller.request_script_revision(deck_id, payload, current_user, db)


@router.get("", response_model=list[AllDeckInfoResponse])
def list_decks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return deck_controller.list_decks(current_user, db)

@router.get("/{deck_id}/status")
def get_deck_generation_status(
    deck_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return deck_controller.get_deck_generation_status(deck_id, current_user, db)