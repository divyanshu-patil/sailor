import logging

from fastapi import HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.auth.clerk import ClerkUser
from app.core.exceptions import (
    AIGenerationError,
    AIResponseParsingError,
)
from app.models.card_model import Card
from app.models.deck_model import Deck
from app.models.user_model import User
from app.schemas.deck_schema import (
    DeckGenerateRequest,
    DeckGenerateResponse,
)
from app.services.deck_generation_service import DeckGenerationService

logger = logging.getLogger(__name__)

def create_deck(
    body: DeckGenerateRequest,
    db: Session,
    generation_service: DeckGenerationService,
    current_user: User,
) -> DeckGenerateResponse:
    """
    Generates a presentation using AI, persists the deck and cards,
    and returns the created deck.
    """
    try:
        ai_output = generation_service.generate(body)
    except AIGenerationError as exc:
        logger.exception("AI generation failed for user %s", current_user.clerk_user_id)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to generate deck content.") from exc
    except AIResponseParsingError as exc:
        logger.exception("Failed to parse AI response for user %s", current_user.clerk_user_id)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="AI returned an invalid response.") from exc

    try:
        deck = Deck(
            title=ai_output.title,
            user_id=current_user.id,
            description=body.description,
            script=ai_output.script,
            color=ai_output.color,
            duration_mins=body.duration_minutes,
            card_count=len(ai_output.cards),
        )
        db.add(deck)
        db.flush()  # generates deck.id

        deck.cards = [
            Card(
                title=c.title,
                position=i,
                description=c.description,
                color=c.color,
                impact=c.impact,
                delivery=c.delivery,
            )
            for i, c in enumerate(ai_output.cards)
        ]

        db.commit()
        db.refresh(deck)
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Failed to persist deck for user %s", current_user.clerk_user_id)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to save generated deck.") from exc

    return DeckGenerateResponse(
        id=deck.id,
        title=deck.title,
        description=deck.description,
        color=deck.color,
        duration_mins=deck.duration_mins,
    )