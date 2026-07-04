import logging
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.exceptions import AIGenerationError, AIResponseParsingError
from app.schemas.deck_schema import DeckGenerateRequest, DeckGenerateResponse
from app.services.deck_generation_service import DeckGenerationService

logger = logging.getLogger(__name__)


def create_deck(
    body: DeckGenerateRequest,
    db: Session,
    generation_service: Optional[DeckGenerationService] = None,
) -> DeckGenerateResponse:
    """Generates deck + card content via AI, persists it, and returns the created deck."""

    service = generation_service or DeckGenerationService()

    try:
        ai_output = service.generate(body)
    except AIGenerationError as exc:
        logger.error("AI generation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to generate deck content. Please try again.",
        ) from exc
    except AIResponseParsingError as exc:
        logger.error("AI response parsing failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI returned an unexpected response. Please try again.",
        ) from exc


      # deck = Deck(
    #     user_id=user_id,
    #     title=ai_output.title,
    #     description=body.description,
    #     color=ai_output.color,
    #     duration_mins=body.duration_minutes,
    #     card_count=len(ai_output.cards),
    #     # script=ai_output.script,  # uncomment once you add the `script` column — see below
    # )

    # deck.cards = [
    #     Card(
    #         position=idx,
    #         title=card.title,
    #         description=card.description,
    #         color=card.color,
    #         impact=card.impact,
    #         delivery=card.delivery,
    #     )
    #     for idx, card in enumerate(ai_output.cards)
    # ]

    # try:
    #     db.add(deck)
    #     db.commit()
    #     db.refresh(deck)
    # except SQLAlchemyError:
    #     db.rollback()
    #     logger.exception("Failed to persist generated deck")
    #     raise HTTPException(
    #         status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
    #         detail="Failed to save the generated deck.",
    #     )

    return {
        "message": "Deck generated successfully",
        "title": ai_output.title,
        "script": ai_output.script,
        "color": ai_output.color,
        "cards": [
            {
                "title": card.title,
                "description": card.description,
                "color": card.color,
                "impact": card.impact,
                "delivery": card.delivery.value,
            }
            for card in ai_output.cards
        ],
        "cardCount": len(ai_output.cards),
    }