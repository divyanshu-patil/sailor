import json
import logging

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, status, Query
from sqlalchemy.orm import Session

import redis.asyncio as aioredis
from app.db.database import SessionLocal, get_db
from app.schemas.deck_schema import (
    DeckCreateRequest,
    DeckResponse,
    AllDeckInfoResponse,
    DeckReviseRequest,
    DeckEditRequest,
)
from app.auth.dependencies import get_current_user, resolve_user_from_claims
from app.models.user_model import User
from app.controllers import deck_controller
from app.auth.clerk import decode_clerk_token
from app.models.deck_model import Deck
from app.utils.enums.deck_enums import DeckGenerationStatus
from app.config.settings import settings

logger = logging.getLogger("uvicorn.access")

router = APIRouter(prefix="/decks", tags=["Decks"])


@router.get("/health")
def get_user_health_check():
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


@router.post("/{deck_id}/revise", response_model=DeckResponse)
def revise_deck(
    deck_id: int,
    payload: DeckReviseRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return deck_controller.revise_deck(deck_id, payload, current_user, db)


@router.post("/{deck_id}/edit", response_model=DeckResponse)
def edit_deck(
    deck_id: int,
    payload: DeckEditRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return deck_controller.edit_deck_script(deck_id, payload, current_user, db)


@router.post("/{deck_id}/confirm", response_model=DeckResponse)
def confirm_deck(
    deck_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return deck_controller.confirm_deck(deck_id, current_user, db)


@router.post("/{deck_id}/cancel", response_model=DeckResponse)
def cancel_deck(
    deck_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return deck_controller.cancel_deck_generation(deck_id, current_user, db)


@router.websocket("/{deck_id}/ws")
async def deck_progress_ws(websocket: WebSocket, deck_id: int, token: str | None = Query(default=None)):
    await websocket.accept()
    logger.info(f"[ws:{deck_id}] accepted connection")

    claims = decode_clerk_token(token) if token else None
    if claims is None:
        logger.info(f"[ws:{deck_id}] no/invalid claims, closing 4401")
        await websocket.close(code=4401)
        return

    db = SessionLocal()
    try:
        user = resolve_user_from_claims(claims, db)
        deck = db.query(Deck).filter(Deck.id == deck_id, Deck.user_id == user.id).one_or_none()
        if deck is None:
            logger.info(f"[ws:{deck_id}] deck not found for user {user.id}, closing 4404")
            await websocket.close(code=4404)
            return

        logger.info(
            f"[ws:{deck_id}] initial status={deck.generation_status.value} "
            f"is_active={deck.generation_status.is_active}"
        )

        if not deck.generation_status.is_active:
            if deck.generation_status == DeckGenerationStatus.COMPLETED:
                script_len = len(deck.script or "")
                logger.info(f"[ws:{deck_id}] sending snapshot: completed, script_len={script_len}")
                await websocket.send_json(
                    {"status": "completed", "deck": DeckResponse.model_validate(deck).model_dump(mode="json")}
                )
            elif deck.generation_status == DeckGenerationStatus.SCRIPT_READY:
                script_len = len(deck.script or "")
                logger.info(f"[ws:{deck_id}] sending snapshot: script_ready, script_len={script_len}")
                await websocket.send_json(
                    {"status": "script_ready", "deck": DeckResponse.model_validate(deck).model_dump(mode="json")}
                )
            elif deck.generation_status == DeckGenerationStatus.CANCELLED:
                logger.info(f"[ws:{deck_id}] sending snapshot: cancelled")
                await websocket.send_json({"status": "cancelled"})
            else:
                logger.info(f"[ws:{deck_id}] sending snapshot: failed, error={deck.generation_error}")
                await websocket.send_json({"status": "failed", "error": deck.generation_error})
            logger.info(f"[ws:{deck_id}] closing 1000 after snapshot")
            await websocket.close(code=1000)
            return
    finally:
        db.close()

    logger.info(f"[ws:{deck_id}] subscribing to redis channel deck:{deck_id}:events")
    redis_client = aioredis.from_url(settings.REDIS_URL)
    pubsub = redis_client.pubsub()
    channel = f"deck:{deck_id}:events"
    await pubsub.subscribe(channel)

    try:
        async for message in pubsub.listen():
            if message["type"] != "message":
                continue
            payload = json.loads(message["data"])
            script_len = len(payload.get("deck", {}).get("script") or "") if payload.get("deck") else None
            logger.info(
                f"[ws:{deck_id}] relaying event status={payload.get('status')} "
                f"has_deck={'deck' in payload} script_len={script_len}"
            )
            await websocket.send_json(payload)
            logger.info(f"[ws:{deck_id}] send_json completed for status={payload.get('status')}")
            if payload.get("status") in ("script_ready", "completed", "failed", "cancelled"):
                logger.info(f"[ws:{deck_id}] terminal status reached, breaking loop")
                break
    except WebSocketDisconnect:
        logger.info(f"[ws:{deck_id}] client disconnected during listen")
    finally:
        logger.info(f"[ws:{deck_id}] cleaning up pubsub/redis")
        await pubsub.unsubscribe(channel)
        await pubsub.close()
        await redis_client.close()
    logger.info(f"[ws:{deck_id}] handler exiting")