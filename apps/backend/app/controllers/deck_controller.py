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


async def create_deck(
    body: DeckGenerateRequest,
    db: Session,
    generation_service: DeckGenerationService,
    current_user: ClerkUser,
) -> DeckGenerateResponse:
    """
    Generates a presentation using AI, persists the deck and cards,
    and returns the created deck.
    """

    user = (
        db.query(User)
        .filter(User.clerk_user_id == current_user.clerk_user_id)
        .one_or_none()
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    # Generate AI content
    try:
        ai_output = await generation_service.generate(body)
    except AIGenerationError as exc:
        logger.exception(
            "AI generation failed for user %s",
            current_user.clerk_user_id,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to generate deck content.",
        ) from exc

    except AIResponseParsingError as exc:
        logger.exception(
            "Failed to parse AI response for user %s",
            current_user.clerk_user_id,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI returned an invalid response.",
        ) from exc


    # sync deck + cards into db
    try:
        with db.begin():

            deck = Deck(
                title=ai_output.title,
                user_id=user.id,
                description=body.description,
                script=ai_output.script,
                color=ai_output.color,
                duration_mins=body.duration_minutes,
                card_count=len(ai_output.cards),
            )

            db.add(deck)
            db.flush()  # Generates deck.id

            deck.cards = [
                Card(
                    title=card.title,
                    position=index,
                    description=card.description,
                    impact=card.impact,
                    delivery=card.delivery,
                )
                for index, card in enumerate(ai_output.cards)
            ]

        db.refresh(deck)

    except SQLAlchemyError as exc:
        logger.exception(
            "Failed to persist deck for user %s",
            current_user.clerk_user_id,
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save generated deck.",
        ) from exc

    # ------------------------------------------------------------------
    # Response
    # ------------------------------------------------------------------
    return DeckGenerateResponse(
        id=deck.id,
        title=deck.title,
        description=deck.description,
        color=deck.color,
        duration_mins=deck.duration_mins,
    )