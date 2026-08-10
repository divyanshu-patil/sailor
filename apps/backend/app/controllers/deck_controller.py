from datetime import datetime, timezone

from sqlalchemy import tuple_
from sqlalchemy import tuple_
from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException, status
from app.core.celery_app import celery_app
from app.models.card_model import Card
from app.models.deck_model import Deck
from app.models.user_model import User
from app.schemas.deck_schema import (
    DeckResponse,
    DeckReviseRequest,
    DeckUpdateRequest,
    PublicDeckItem,
    PublicDecksPage,
)
from app.tasks.deck_tasks import revise_deck_script
from app.services.realtime.deck_events import read_deck_status, write_deck_status

from app.utils.enums.deck_enums import GenerationStatus
from app.utils.pagination import InvalidCursorError, decode_cursor, encode_cursor

# Decks are no longer created directly.
#
# A deck used to be created the instant the user tapped Generate, with the script
# job hung off it — so every abandoned or discarded generation left a permanent,
# card-less "ghost" deck in the grid. Creation now happens in
# script_controller.create_deck_from_generation, at the one moment the user
# actually accepts a script, and everything in this module operates on decks that
# are already real.


DEFAULT_PUBLIC_PAGE_SIZE = 20
MAX_PUBLIC_PAGE_SIZE = 50


def get_deck(deck_id: int, current_user: User, db: Session) -> Deck:
    deck = (
        db.query(Deck)
        .filter(
            Deck.id == deck_id,
            Deck.user_id == current_user.id,
            Deck.is_deleted == False,  # noqa: E712
        )
        .one_or_none()
    )
    if deck is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found")
    return deck


def update_deck(
    deck_id: int, payload: DeckUpdateRequest, current_user: User, db: Session
) -> Deck:
    """Manual edits only — no AI involved, so this is synchronous."""
    deck = get_deck(deck_id, current_user, db)

    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        return deck

    if "script" in changes and deck.generation_status in (
        GenerationStatus.PENDING,
        GenerationStatus.PROCESSING,
    ):
        # The Celery job is about to write this same column; letting the edit
        # through would either be clobbered by the worker or blow up on the
        # version_id_col check with an opaque StaleDataError.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The script is still generating — wait for it to finish before editing it.",
        )

    for field, value in changes.items():
        setattr(deck, field, value)

    db.commit()
    db.refresh(deck)

    # The status endpoint answers from Redis first, so a stale cached payload
    # would keep serving the pre-edit script until the TTL expired.
    if deck.generation_status == GenerationStatus.COMPLETED:
        write_deck_status(
            deck_id,
            {"status": "completed", "deck": DeckResponse.model_validate(deck).model_dump(mode="json")},
        )

    return deck


def request_script_revision(
    deck_id: int, payload: DeckReviseRequest, current_user: User, db: Session
) -> Deck:
    """AI revision — async, same status lifecycle as the initial generation, so
    the client polls /decks/{id}/status for both."""
    deck = get_deck(deck_id, current_user, db)

    if not deck.script:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="There's no script to revise yet — wait for generation to finish.",
        )
    if deck.generation_status in (GenerationStatus.PENDING, GenerationStatus.PROCESSING):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This script is already being generated or revised.",
        )

    deck.generation_status = GenerationStatus.PENDING
    deck.generation_error = None
    db.commit()
    db.refresh(deck)

    # Overwrite the cached "completed" payload immediately: without this the
    # client's first poll after kicking off a revision would read the finished
    # pre-revision deck out of Redis and stop polling.
    write_deck_status(deck_id, {"status": "pending"})

    task = revise_deck_script.delay(deck.id, payload.instruction)
    deck.celery_task_id = task.id
    db.commit()
    db.refresh(deck)

    return deck


def revoke_task(task_id: str | None) -> None:
    """
    Kill an in-flight Celery task, not just un-queue it.

    `terminate=True` is the part that matters here. Script generation spends
    almost all of its wall time blocked inside a single synchronous HTTP call to
    the AI provider, so a plain revoke — which only stops a task that hasn't
    started — would leave the provider generating and billing for a script
    nobody is waiting for. Terminating signals the worker's child process, which
    tears down that connection.

    Safe to call with a stale or already-finished task id: revoking one is a
    no-op. `task_acks_late=True` would normally redeliver a killed task, but
    Celery keeps revoked ids in its revoked set and discards the redelivery.
    """
    if not task_id:
        return
    celery_app.control.revoke(task_id, terminate=True, signal="SIGTERM")


def cancel_script_generation(deck_id: int, current_user: User, db: Session) -> Deck:
    """User pressed Stop. Kills the job at the provider and parks the deck in
    CANCELLED — recoverable, since the deck row and everything already written
    survive; the app offers "Try again" from here."""
    deck = get_deck(deck_id, current_user, db)

    if deck.generation_status not in (
        GenerationStatus.PENDING,
        GenerationStatus.PROCESSING,
    ):
        # Nothing running — most often the job finished in the gap between the
        # user's last poll and the tap. Report the deck as-is rather than
        # erroring: from the user's side "stop something already stopped"
        # succeeded.
        return deck

    revoke_task(deck.celery_task_id)

    deck.generation_status = GenerationStatus.CANCELLED
    deck.generation_error = None
    db.commit()
    db.refresh(deck)

    # Overwrite the cached "processing" payload, or the client's next poll reads
    # it straight back out of Redis and carries on as if nothing was cancelled.
    write_deck_status(deck_id, {"status": "cancelled"})

    return deck


def delete_deck(deck_id: int, current_user: User, db: Session) -> None:
    """
    Soft delete, matching the intent of the model's is_deleted/deleted_at columns
    — the row and its cards stay put so an accidental delete is recoverable and
    FK history survives for support.

    Any in-flight generation is killed first: without that, a worker would keep
    paying the AI provider to finish a script for a deck the user just threw away,
    and would then write it back onto the deleted row.
    """
    deck = get_deck(deck_id, current_user, db)

    revoke_task(deck.celery_task_id)
    revoke_task(deck.cards_celery_task_id)

    deck.is_deleted = True
    deck.deleted_at = datetime.now(timezone.utc)
    db.commit()


def list_decks(current_user: User, db: Session) -> list[Deck]:
    """
    The user's decks, newest first.

    Card-less decks are excluded. By construction there shouldn't be any — a deck
    and its cards are written in one transaction by
    script_tasks.build_deck_from_generation — but this is the query that decides
    what the user sees, and a deck with nothing in it is never something they
    want to look at. Cheap insurance against a ghost surviving a migration, a
    failed card regeneration, or a future code path that inserts a deck first.
    """
    return (
        db.query(Deck)
        .filter(
            Deck.user_id == current_user.id,
            Deck.is_deleted == False,  # noqa: E712
            db.query(Card.id).filter(Card.deck_id == Deck.id).exists(),
        )
        .order_by(Deck.created_at.desc())
        .all()
    )


def get_deck_generation_status(deck_id: int, current_user: User, db: Session) -> dict:
    row = (
        db.query(Deck.id, Deck.generation_status, Deck.generation_error)
        .filter(Deck.id == deck_id, Deck.user_id == current_user.id, Deck.is_deleted == False)  # noqa: E712
        .one_or_none()
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found")

    cached = read_deck_status(deck_id)
    if cached is not None:
        return cached

    # Redis cache miss — either the task hasn't written its first status yet
    # (deck is still PENDING), or the key's TTL expired long after a
    # completed/failed run. Postgres is the fallback source of truth either way.
    if row.generation_status == GenerationStatus.COMPLETED:
        deck = db.query(Deck).filter(Deck.id == deck_id).one()
        return {"status": "completed", "deck": DeckResponse.model_validate(deck).model_dump(mode="json")}
    if row.generation_status == GenerationStatus.FAILED:
        return {"status": "failed", "error": row.generation_error}
    return {"status": row.generation_status.value}


def list_public_decks(cursor: str | None, limit: int, db: Session) -> PublicDecksPage:
    
    limit = min(limit, MAX_PUBLIC_PAGE_SIZE)

    query = (
        db.query(Deck)
        # PublicDeckItem reads deck.user for the creator byline on every row.
        # Without this, SQLAlchemy lazy-loads each deck's user separately —
        # 20 decks on a page = 20 extra round trips. joinedload folds that
        # into the same query as a SQL JOIN: one round trip, period.
        .options(joinedload(Deck.user))
        .filter(
            Deck.is_public == True, 
            Deck.is_deleted == False,
            Deck.generation_status == GenerationStatus.COMPLETED,
        )
    )

    if cursor:
        try:
            last_created_at, last_id = decode_cursor(cursor)
        except InvalidCursorError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid pagination cursor.",
            )
        # Row-value comparison: "everything strictly after this (created_at, id)
        # pair" in DESC order. This is what lets Postgres seek straight into
        # ix_decks_public_feed instead of scanning from the top every request.
        query = query.filter(
            tuple_(Deck.created_at, Deck.id) < (last_created_at, last_id)
        )

    # Fetch one extra row purely to answer "is there a next page?" without a
    # separate COUNT(*) query — cheap, and avoids a second round trip.
    rows = (
        query.order_by(Deck.created_at.desc(), Deck.id.desc())
        .limit(limit + 1)
        .all()
    )

    has_more = len(rows) > limit
    rows = rows[:limit]

    next_cursor = (
        encode_cursor(rows[-1].created_at, rows[-1].id) if has_more and rows else None
    )

    return PublicDecksPage(
        items=[PublicDeckItem.model_validate(deck) for deck in rows],
        next_cursor=next_cursor,
        has_more=has_more,
    )