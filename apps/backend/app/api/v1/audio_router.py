from fastapi import APIRouter, Depends, UploadFile
from app.controllers.audio_controller import (
    get_audio_playback_url,
    remove_audio_for_deck,
    upload_audio_for_deck,
)
from app.auth.dependencies import get_current_user
from app.db.database import get_db
from app.models.user_model import User
from sqlalchemy.orm import Session

router = APIRouter(prefix="/decks", tags=["Decks"])

@router.post("/{deck_id}/audio")
async def upload_audio_endpoint(
    deck_id: int,
    file: UploadFile,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return await upload_audio_for_deck(deck_id, file, current_user, db)

@router.delete("/{deck_id}/audio")
def remove_audio_endpoint(
    deck_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return remove_audio_for_deck(deck_id, current_user, db)

@router.get("/{deck_id}/audio-url")
def audio_url_endpoint(
    deck_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_audio_playback_url(deck_id, current_user, db)
