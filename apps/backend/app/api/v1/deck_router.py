from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.controllers.deck_controller import create_deck
from app.db.database import get_db
from app.schemas.deck_schema import DeckGenerateRequest, DeckGenerateResponse
from app.services.deck_generation_service import DeckGenerationService
from app.auth.dependencies import get_current_user
from app.models.user_model import User
from app.services.ai_dependencies import get_deck_generation_service

router = APIRouter(prefix="/decks", tags=["Decks"])


@router.get("/")
def deck_health_check(current_user: User = Depends(get_current_user),):
    """Simple health check for decks — no auth required."""
    return {"status": "ok", "service": "deck-router", "user": current_user.email}


@router.post("/generate", response_model=DeckGenerateResponse, status_code=status.HTTP_201_CREATED)
def generate_deck(
    body: DeckGenerateRequest,
    current_user: User = Depends(get_current_user),
    generation_service: DeckGenerationService = Depends(get_deck_generation_service),
    db: Session = Depends(get_db),
):
    """Generate a new deck of cards using AI."""
    return create_deck(body, db, generation_service, current_user)