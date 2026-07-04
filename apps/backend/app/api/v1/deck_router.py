from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.controllers.deck_controller import create_deck
from app.db.database import get_db
from app.schemas.deck_schema import DeckGenerateRequest, DeckGenerateResponse
from app.services.deck_generation_service import DeckGenerationService
from app.auth.clerk import get_current_clerk_user, ClerkUser
from app.services.ai_dependencies import get_deck_generation_service

router = APIRouter(prefix="/decks", tags=["Decks"])


@router.get("/")
def deck_health_check(current_user: ClerkUser = Depends(get_current_clerk_user)):
    """Simple health check for decks — no auth required."""
    return {"status": "ok", "service": "deck-router", "user": current_user.clerk_user_id}


@router.post("/generate", response_model=DeckGenerateResponse, status_code=status.HTTP_201_CREATED)
async def generate_deck(
    body: DeckGenerateRequest,
    current_user: ClerkUser = Depends(get_current_clerk_user),
    generation_service: DeckGenerationService = Depends(get_deck_generation_service),
    db: Session = Depends(get_db),
):
    """Generate a new deck of cards using AI."""
    return await create_deck(body, db, generation_service, current_user)