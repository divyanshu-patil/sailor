# app/controllers/audio_controller.py
from datetime import datetime, timezone

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.models.deck_model import Deck
from app.models.user_model import User
from app.services.storage_service import (
    AudioStorageError,
    delete_deck_audio,
    get_deck_audio_url,
    upload_deck_audio,
)


def _get_owned_deck(deck_id: int, current_user: User, db: Session) -> Deck:
    deck = (
        db.query(Deck)
        .filter(Deck.id == deck_id, Deck.user_id == current_user.id, Deck.is_deleted == False)  # noqa: E712
        .one_or_none()
    )
    if deck is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Deck not found")
    return deck


async def upload_audio_for_deck(
    deck_id: int, file: UploadFile, current_user: User, db: Session
) -> dict:
    deck = _get_owned_deck(deck_id, current_user, db)

    try:
        object_name = await upload_deck_audio(deck_id, file)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    except AudioStorageError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc

    deck.audio_key = object_name
    deck.audio_uploaded_at = datetime.now(timezone.utc)
    db.commit()

    return {"deck_id": deck.id, "has_audio": True}


def get_audio_playback_url(deck_id: int, current_user: User, db: Session) -> dict:
    deck = _get_owned_deck(deck_id, current_user, db)

    if deck.audio_key is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No audio recorded for this deck")

    try:
        url = get_deck_audio_url(deck.audio_key)
    except AudioStorageError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc

    return {"audio_url": url, "expires_in_seconds": 900}


def remove_audio_for_deck(deck_id: int, current_user: User, db: Session) -> dict:
    """Called when a deck is deleted — the recording doesn't get overwritten
    away on its own the way a re-record would, so this is the only path that
    still needs an explicit delete call."""
    deck = _get_owned_deck(deck_id, current_user, db)

    if deck.audio_key is not None:
        try:
            delete_deck_audio(deck.audio_key)
        except AudioStorageError as exc:
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc
        deck.audio_key = None
        deck.audio_uploaded_at = None
        db.commit()

    return {"deck_id": deck.id, "has_audio": False}