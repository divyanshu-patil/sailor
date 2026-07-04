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
    DeckInfoResponse,
    CardResponse,
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

def get_all_decks(db: Session, current_user: User) -> list[DeckGenerateResponse]:
    """
    Retrieves all decks for the current user.
    """
    try:
        decks = db.query(Deck).filter(Deck.user_id == current_user.id).all()
        return [
            DeckGenerateResponse(
                id = deck.id,
                title= deck.title,
                color= deck.color,
                duration_mins= deck.duration_mins

            ) for deck in decks
        ]
    
    except SQLAlchemyError as exc:
        logger.exception("Failed to retrieve decks for user %s", current_user.clerk_user_id)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve decks.") from exc
    

def get_deck_by_id(deck_id: int, current_user: User, db: Session ) -> DeckInfoResponse:
    """
    Retrieves info of deck based on provided id
    """
    try:
        deck = db.query(Deck).filter(Deck.id == deck_id).first()

        if deck is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="deck with id not present. ")
        
        return DeckInfoResponse(
            id = deck.id,
            title= deck.title,
            description= deck.description,
            script= deck.script,
            color= deck.color,
            duration_mins= deck.duration_mins,
            card_count= deck.card_count,
            is_favorite= deck.is_favorite,
            created_at= deck.created_at
        )

    except SQLAlchemyError as exc:
        logger.exception("Failed to retrieve decks for user %s", current_user.clerk_user_id)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve decks.") from exc


def get_deck_cards(deck_id: int, current_user: User, db: Session) -> list[CardResponse]:
    """
     retrieves all cards for a specific deck.
    """
    try:
        deck = db.query(Deck).filter(Deck.id == deck_id).first()

        if deck is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="deck with id not present. ")
        
        cards = db.query(Card).filter(Card.deck_id == deck_id).order_by(Card.position).all()

        if cards is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No cards found for the specified deck.")

        return [
            CardResponse(
                id=card.id,
                position=card.position,
                title=card.title,
                description=card.description,
                color=card.color,
                impact=card.impact,
                delivery=card.delivery
            ) for card in cards
        ]

    except SQLAlchemyError as exc:
        logger.exception("Failed to retrieve cards for deck %s and user %s", deck_id, current_user.clerk_user_id)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve cards.") from exc