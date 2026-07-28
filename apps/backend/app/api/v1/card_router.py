from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.controllers import card_controller
from app.db.database import get_db
from app.models.user_model import User
from app.schemas.card_schema import (
    CardCreateParams,
    CardGenerationStatusResponse,
    CardResponse,
    CardUpdateParams,
)

router = APIRouter(prefix="/decks/{deck_id}/cards", tags=["Cards"])


@router.get("", response_model=list[CardResponse])
def list_cards(
    deck_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return card_controller.list_cards(deck_id, current_user, db)


# @router.post("", response_model=CardResponse, status_code=status.HTTP_201_CREATED)
# def create_card(
#     deck_id: int,
#     payload: CardCreateParams,
#     current_user: User = Depends(get_current_user),
#     db: Session = Depends(get_db),
# ):
#     return card_controller.create_card(deck_id, payload, current_user, db)



@router.post("/generate", response_model=CardGenerationStatusResponse, status_code=status.HTTP_202_ACCEPTED)
def generate_cards(
    deck_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return card_controller.request_card_generation(deck_id, current_user, db)


@router.post("/cancel", response_model=CardGenerationStatusResponse)
def cancel_card_generation(
    deck_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Stop an in-flight card job and clear whatever it had already written."""
    return card_controller.cancel_card_generation(deck_id, current_user, db)


@router.get("/status")
def get_card_generation_status(
    deck_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return card_controller.get_card_generation_status(deck_id, current_user, db)


# ---------------------------------------------------------------------------
# Parameterised routes last, on purpose.
#
# FastAPI matches in declaration order, so a `/{card_id}` declared above would
# swallow `/status`, `/generate` and `/cancel` — `GET .../cards/status` would bind
# card_id="status" and 422 on the int coercion instead of reaching the handler
# below it.
# ---------------------------------------------------------------------------


@router.get("/{card_id}", response_model=CardResponse)
def get_card(
    deck_id: int,
    card_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return card_controller.get_card(deck_id, card_id, current_user, db)


@router.patch("/{card_id}", response_model=CardResponse)
def update_card(
    deck_id: int,
    card_id: int,
    payload: CardUpdateParams,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Manual card edit. Send the `expected_version` the card was read at; a 409
    means it changed elsewhere first and the edit needs re-applying."""
    return card_controller.update_card(deck_id, card_id, payload, current_user, db)