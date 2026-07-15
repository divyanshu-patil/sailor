from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.controllers.deck_controller import create_deck, get_all_decks, get_deck_by_id, get_deck_cards
from app.db.database import get_db
from app.schemas.deck_schema import AllDeckInfoResponse, CardResponse, DeckGenerateRequest, DeckGenerateResponse, DeckInfoResponse
from app.services.deck_generation_service import DeckGenerationService
from app.auth.dependencies import get_current_user
from app.models.user_model import User
from app.services.ai_dependencies import get_deck_generation_service

router = APIRouter(prefix="/decks", tags=["Decks"])

@router.post("/generate", response_model=DeckGenerateResponse, status_code=status.HTTP_201_CREATED)
def generate_deck(
    body: DeckGenerateRequest,
    current_user: User = Depends(get_current_user),
    generation_service: DeckGenerationService = Depends(get_deck_generation_service),
    db: Session = Depends(get_db),
):
    """Generate a new deck of cards using AI."""
    return create_deck(body, db, generation_service, current_user)

@router.get("/", response_model=list[AllDeckInfoResponse], status_code=status.HTTP_200_OK)
def get_all_user_decks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all decks for the current user."""
    return get_all_decks(db, current_user)

@router.get("/{deck_id}", response_model=DeckInfoResponse, status_code=status.HTTP_200_OK)
def get_deck(deck_id: int, current_user: User = Depends(get_current_user) , db: Session = Depends(get_db) ):
    """Get a specific deck by ID for the current user."""
    return get_deck_by_id(deck_id, current_user, db)


@router.get("/{deck_id}/cards", response_model=list[CardResponse], status_code=status.HTTP_200_OK)
def get_cards(
    deck_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all cards for a specific deck."""
    return get_deck_cards(deck_id, current_user, db)