from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, get_current_user_optional
from app.controllers import deck_controller
from app.db.database import get_db
from app.models.user_model import User
from app.schemas.deck_schema import (
    AllDeckInfoResponse,
    DeckPracticeResponse,
    DeckPublishRequest,
    DeckResponse,
    DeckReviseRequest,
    DeckUpdateRequest,
    PublicDeckDetail,
    PublicDeckItem,
    PublicDecksPage,
)
from app.utils.enums.deck_enums import DeckCategory

router = APIRouter(prefix="/decks", tags=["Decks"])

# There is deliberately no POST /decks.
#
# A deck is only ever born from an accepted script, at POST
# /scripts/{id}/deck — which is what keeps the grid free of card-less ghost
# decks left behind by generations the user walked away from. Everything here
# operates on decks that already exist.


@router.get("/health")
def get_user_health_check():
    """Simple health check for users — no auth required."""
    return {"status": "ok", "service": "Deck-router"}

@router.get("/public", response_model=PublicDecksPage, response_model_by_alias=False)
def list_public_decks(
    cursor: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=50),
    q: str | None = Query(default=None, max_length=100, description="Title/description search"),
    category: DeckCategory | None = Query(default=None),
    tag: str | None = Query(default=None, max_length=24),
    sort: str = Query(default="recent", pattern="^(recent|popular|duration)$"),
    db: Session = Depends(get_db),
):
    """The public feed. No auth dependency on purpose — browsing public decks
    shouldn't require a signed-in user, matching /health above it."""
    return deck_controller.list_public_decks(
        cursor, limit, db, q=q, category=category, tag=tag, sort=sort
    )


# Declared before /{deck_id} so the literal segment isn't swallowed by the
# parameterised route — same ordering rule as card_router.
@router.get("/public/{deck_id}", response_model=PublicDeckDetail, response_model_by_alias=False)
def get_public_deck(
    deck_id: int,
    current_user: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """One published deck, script included, for the discover detail screen.

    Readable signed out; a signed-in reader additionally gets `isSaved`, so the
    bookmark button renders correctly without fetching their whole saved list.
    """
    deck = deck_controller.get_public_deck(deck_id, db)
    payload = PublicDeckDetail.model_validate(deck)
    payload.isSaved = deck_controller.is_deck_saved(deck_id, current_user, db)
    return payload


@router.post("/public/{deck_id}/practice", response_model=DeckPracticeResponse, response_model_by_alias=False)
def record_practice(deck_id: int, db: Session = Depends(get_db)):
    """Called when a practice run starts. Fire-and-forget from the client's
    point of view — a lost increment is not worth blocking the screen on."""
    return {"practice_count": deck_controller.record_practice(deck_id, db)}


@router.get("/saved", response_model=list[PublicDeckItem], response_model_by_alias=False)
def list_saved_decks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """The user's bookmarked public decks. Declared above `/{deck_id}` so the
    literal segment isn't captured as a deck id."""
    return deck_controller.list_saved_decks(current_user, db)


@router.post("/public/{deck_id}/save", status_code=status.HTTP_204_NO_CONTENT)
def save_public_deck(
    deck_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Bookmark a public deck — a reference, not a copy. Idempotent."""
    deck_controller.save_public_deck(deck_id, current_user, db)


@router.delete("/public/{deck_id}/save", status_code=status.HTTP_204_NO_CONTENT)
def unsave_public_deck(
    deck_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    deck_controller.unsave_public_deck(deck_id, current_user, db)


@router.post("/{deck_id}/publish", response_model=DeckResponse)
def publish_deck(
    deck_id: int,
    payload: DeckPublishRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Enter discovery. Requires description, at least one tag and a category —
    the review sheet collects all three before this is ever called."""
    return deck_controller.publish_deck(deck_id, payload, current_user, db)


@router.post("/{deck_id}/unpublish", response_model=DeckResponse)
def unpublish_deck(
    deck_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Leave discovery. The published metadata is kept for a later republish."""
    return deck_controller.unpublish_deck(deck_id, current_user, db)


@router.get("/{deck_id}", response_model=DeckResponse)
def get_deck(
    deck_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return deck_controller.get_deck(deck_id, current_user, db)


@router.patch("/{deck_id}", response_model=DeckResponse)
def update_deck(
    deck_id: int,
    payload: DeckUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Manual edits: the script editor, a rename, the favourite toggle."""
    return deck_controller.update_deck(deck_id, payload, current_user, db)


@router.post("/{deck_id}/revise", response_model=DeckResponse, status_code=status.HTTP_202_ACCEPTED)
def revise_deck_script(
    deck_id: int,
    payload: DeckReviseRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Kicks off an AI rewrite of the existing script. Poll /{deck_id}/status
    for the result, exactly as with the initial generation."""
    return deck_controller.request_script_revision(deck_id, payload, current_user, db)


@router.delete("/{deck_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_deck(
    deck_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Soft delete — the deck stops appearing in listings but the row survives, so
    an accidental delete stays recoverable. Cancels any in-flight generation."""
    deck_controller.delete_deck(deck_id, current_user, db)


@router.post("/{deck_id}/cancel", response_model=DeckResponse)
def cancel_deck_script_generation(
    deck_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Stop an in-flight script job. Terminates the worker so the AI provider
    stops generating, rather than only dropping the task from the queue."""
    return deck_controller.cancel_script_generation(deck_id, current_user, db)


@router.get("", response_model=list[AllDeckInfoResponse], response_model_by_alias=False)
def list_decks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """`response_model_by_alias=False` is load-bearing.

    AllDeckInfoResponse names its fields in camelCase and uses snake_case
    *aliases* to read them off the SQLAlchemy model. FastAPI serialises by alias
    by default, so this endpoint was emitting `card_count` / `duration_mins`
    while the client read `slideCount` / `durationMins` — every deck arrived with
    0 cards and a NaN duration, and the malformed row raced the correct one from
    the detail endpoint. Serialising by field name is what the schema was written
    for.
    """
    return deck_controller.list_decks(current_user, db)

@router.get("/{deck_id}/status")
def get_deck_generation_status(
    deck_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return deck_controller.get_deck_generation_status(deck_id, current_user, db)
