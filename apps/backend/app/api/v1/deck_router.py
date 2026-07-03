from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.controllers.deck_controller import create_deck
from app.db.database import get_db
from app.schemas.deck_schema import DeckGenerateRequest, DeckGenerateResponse
# from app.core.security import get_current_user_id  # TODO: your real auth dependency

router = APIRouter(prefix="/decks", tags=["Decks"])


@router.get("/")
def deck_health_check():
    """Simple health check for decks — no auth required."""
    return {"status": "ok", "service": "deck-router"}


@router.post("/generate",)
def generate_deck(
    body: DeckGenerateRequest,
    db: Session = Depends(get_db),
):
    """Generate a new deck of cards using AI."""
    return create_deck(body, db)