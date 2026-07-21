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
from app.utils.enums.deck_enums import DeckGenerationStatus
from app.config.settings import settings

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

@router.websocket("/{deck_id}/ws")
async def deck_progress_ws(websocket: WebSocket, deck_id: int, token: str | None = Query(default=None)):
    await websocket.accept()

    claims = decode_clerk_token(token) if token else None
    if claims is None:
        await websocket.close(code=4401)
        return

    db = SessionLocal()
    try:
        user = resolve_user_from_claims(claims, db)
        deck = db.query(Deck).filter(Deck.id == deck_id, Deck.user_id == user.id).one_or_none()
        if deck is None:
            await websocket.close(code=4404)
            return

        # Already finished by the time the client connected — send final state and stop.
        if deck.generation_status in (DeckGenerationStatus.COMPLETED, DeckGenerationStatus.FAILED):
            if deck.generation_status == DeckGenerationStatus.COMPLETED:
                await websocket.send_json(
                    {"status": "completed", "deck": DeckResponse.model_validate(deck).model_dump(mode="json")}
                )
            else:
                await websocket.send_json({"status": "failed", "error": deck.generation_error})
            await websocket.close(code=1000)
            return
    finally:
        db.close()

    redis_client = aioredis.from_url(settings.REDIS_URL)
    pubsub = redis_client.pubsub()
    channel = f"deck:{deck_id}:events"
    await pubsub.subscribe(channel)

    try:
        async for message in pubsub.listen():
            if message["type"] != "message":
                continue
            payload = json.loads(message["data"])
            await websocket.send_json(payload)
            if payload.get("status") in ("completed", "failed"):
                break
    except WebSocketDisconnect:
        pass
    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.close()
        await redis_client.close()