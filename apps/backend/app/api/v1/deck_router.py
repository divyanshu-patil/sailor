from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.deck_schema import DeckCreateRequest, DeckResponse
from app.auth.dependencies import get_current_user
from app.models.user_model import User
from app.controllers import deck_controller

router = APIRouter(prefix="/decks", tags=["Decks"])

@router.get("/health")
def get_user_health_check():
    """Simple health check for users — no auth required."""
    return {"status": "ok", "service": "Deck-router"}

@router.post("/script/generate", response_model=DeckResponse, status_code=status.HTTP_201_CREATED)
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


# @router.get("/", response_model=list[AllDeckInfoResponse], status_code=status.HTTP_200_OK)
# def get_all_user_decks(
#     current_user: User = Depends(get_current_user),
#     db: Session = Depends(get_db),
# ):
#     """Get all decks for the current user."""
#     return get_all_decks(db, current_user)

# @router.get("/{deck_id}", response_model=DeckInfoResponse, status_code=status.HTTP_200_OK)
# def get_deck(deck_id: int, current_user: User = Depends(get_current_user) , db: Session = Depends(get_db) ):
#     """Get a specific deck by ID for the current user."""
#     return get_deck_by_id(deck_id, current_user, db)


# @router.get("/{deck_id}/cards", response_model=list[CardResponse], status_code=status.HTTP_200_OK)
# def get_cards(
#     deck_id: int,
#     current_user: User = Depends(get_current_user),
#     db: Session = Depends(get_db),
# ):
#     """Get all cards for a specific deck."""
#     return get_deck_cards(deck_id, current_user, db)