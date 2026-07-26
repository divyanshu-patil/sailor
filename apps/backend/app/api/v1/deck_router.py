import json

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, status, Query
from sqlalchemy.orm import Session

import redis.asyncio as aioredis
from app.db.database import SessionLocal, get_db
from app.schemas.deck_schema import DeckCreateRequest, DeckResponse, AllDeckInfoResponse
from app.auth.dependencies import get_current_user, resolve_user_from_claims
from app.models.user_model import User
from app.controllers import deck_controller
from app.auth.clerk import decode_clerk_token
from app.models.deck_model import Deck

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


@router.get("/", response_model=list[AllDeckInfoResponse])
def list_decks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return deck_controller.list_decks(current_user, db)

@router.get("/{deck_id}/status")
def get_deck_generation_status(
    deck_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return deck_controller.get_deck_generation_status(deck_id, current_user, db)
