from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.controllers import deck_controller
from app.db.database import get_db
from app.models.user_model import User
from app.schemas.deck_schema import (
    AllDeckInfoResponse,
    DeckResponse,
    DeckReviseRequest,
    DeckUpdateRequest,
)

router = APIRouter(prefix="/decks", tags=["Decks"])

# There is deliberately no POST /decks.
#
# A deck is only ever born from an accepted script, at POST
# /scripts/{id}/deck — which is what keeps the grid free of card-less ghost
# decks left behind by generations the user walked away from. Everything here
# operates on decks that already exist.


@router.get("/health")
def get_user_health_check():
    """Simple health check for users — no auth required."""
    return {"status": "ok", "service": "Deck-router"}


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


@router.delete("/{deck_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_deck(
    deck_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Soft delete — the deck stops appearing in listings but the row survives, so
    an accidental delete stays recoverable. Cancels any in-flight generation."""
    deck_controller.delete_deck(deck_id, current_user, db)


@router.post("/{deck_id}/cancel", response_model=DeckResponse)
def cancel_deck_script_generation(
    deck_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Stop an in-flight script job. Terminates the worker so the AI provider
    stops generating, rather than only dropping the task from the queue."""
    return deck_controller.cancel_script_generation(deck_id, current_user, db)


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