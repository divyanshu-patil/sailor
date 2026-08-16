import logging
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.attachment_model import Attachment
from app.models.deck_model import Deck
from app.models.script_model import ScriptGeneration, ScriptVersion
from app.models.user_model import User
from app.schemas.script_schema import (
    ScriptEditRequest,
    ScriptGenerateRequest,
    ScriptReviseRequest,
)
from app.controllers.attachment_controller import get_owned_attachments
from app.services.ai.card_generator import CardGenerationError, split_script_into_segments
from app.services.realtime.script_events import (
    clear_script_status,
    read_generation_cards_status,
    read_script_status,
    write_generation_cards_status,
    write_script_status,
)
from app.services.scripts.fingerprint import brief_fingerprint
from app.services.scripts.versions import append_version, version_count
from app.services.storage_service import AttachmentStorageError, delete_attachment
from app.tasks.script_tasks import build_deck_from_generation, generate_script_task
from app.utils.enums.deck_enums import GenerationStatus, ScriptVersionKind

# Statuses a generation can be handed back in instead of starting a new job for
# the same brief. A run that FAILED is excluded deliberately — re-submitting an
# identical brief after a failure is the user asking to try again, and silently
# handing back the failure would look like the button did nothing.
REUSABLE_STATUSES = (
    GenerationStatus.PENDING,
    GenerationStatus.PROCESSING,
    GenerationStatus.COMPLETED,
)

logger = logging.getLogger("celery")


def _revoke(task_id: str | None) -> None:
    # Imported lazily: deck_controller imports this module's siblings, and a
    # module-level import here closes the cycle.
    from app.controllers.deck_controller import revoke_task

    revoke_task(task_id)


def _purge_generation_attachments(generation_id: int, db: Session) -> None:
    """Drop the source files of a discarded draft. Only reached from discard —
    a cancel keeps them, because retry re-runs against the same brief."""
    rows = db.query(Attachment).filter(Attachment.generation_id == generation_id).all()
    for row in rows:
        try:
            delete_attachment(row.object_key)
        except AttachmentStorageError as exc:
            logger.warning(f"[script_controller] leaked object {row.object_key}: {exc}")
        db.delete(row)
    if rows:
        db.commit()


def get_generation(generation_id: int, current_user: User, db: Session) -> ScriptGeneration:
    generation = (
        db.query(ScriptGeneration)
        .filter(
            ScriptGeneration.id == generation_id,
            ScriptGeneration.user_id == current_user.id,
            ScriptGeneration.is_deleted == False,  # noqa: E712
        )
        .one_or_none()
    )
    if generation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Script not found")
    return generation


def serialize_generation(
    db: Session, generation: ScriptGeneration, *, versions: int | None = None
) -> dict:
    """The response body every endpoint here returns. `version_count` is what the
    client's undo/redo arrows enable themselves from, so it travels with every
    response rather than needing a second call.

    `versions` short-circuits that count for a caller that already knows it — a
    generation created moments ago has none, and counting rows to be told zero
    is a round trip nobody needs."""
    return {
        "id": generation.id,
        "description": generation.description,
        "duration_mins": generation.duration_mins,
        "card_count": generation.card_count,
        "audience": generation.audience,
        "title": generation.title,
        "script": generation.script,
        "status": generation.status,
        "error": generation.error,
        "deck_id": generation.deck_id,
        "version_count": version_count(db, generation.id) if versions is None else versions,
        "created_at": generation.created_at,
        "updated_at": generation.updated_at,
    }


def start_generation(
    payload: ScriptGenerateRequest,
    current_user: User,
    db: Session,
) -> dict:
    """
    Start a script generation — or hand back the one this brief already has.

    The dedupe is the reason this endpoint exists in this shape. Backing out of
    the preview screen to the wizard and pressing Generate again used to discard
    a running or finished script and pay to produce an identical one, because
    every tap created a fresh deck row and a fresh job. Now an unchanged brief
    resolves to the same generation, and the only thing the client has to do is
    resume polling it.

    Attachments arrive as ids, not as files. They were uploaded one at a time
    while the user was still filling in the form — which is what lets the wizard
    show real progress and hold Next until the uploads land, and what stops a
    20MB deck being discovered as too large only after the brief is complete.
    Submitting the brief claims them: `generation_id` goes from null to this row.
    """
    attachments = get_owned_attachments(payload.attachment_ids, current_user, db)

    fingerprint = brief_fingerprint(
        description=payload.description,
        duration_mins=payload.duration_mins,
        card_count=payload.card_count,
        audience=payload.audience,
    )

    # The text-only fingerprint describes neither the attached material nor the
    # reference links. Reusing a text-identical generation for a different set
    # of sources would return a script grounded in the wrong ones, so a brief
    # carrying either always starts fresh.
    if not attachments and not payload.links:
        existing = (
            db.query(ScriptGeneration)
            .filter(
                ScriptGeneration.user_id == current_user.id,
                ScriptGeneration.fingerprint == fingerprint,
                ScriptGeneration.is_deleted == False,  # noqa: E712
                # A generation that already became a deck is finished business. The
                # user is on the wizard asking for a new one, so give them one rather
                # than reopening a deck they already created.
                ScriptGeneration.deck_id.is_(None),
                ScriptGeneration.status.in_(REUSABLE_STATUSES),
            )
            .order_by(ScriptGeneration.created_at.desc())
            .first()
        )
        if existing is not None:
            touch_generation(existing, db)
            return {"generation": serialize_generation(db, existing), "reused": True}

    generation = ScriptGeneration(
        user_id=current_user.id,
        description=payload.description,
        duration_mins=payload.duration_mins,
        card_count=payload.card_count,
        audience=payload.audience,
        fingerprint=fingerprint,
        links="\n".join(payload.links) or None,
        status=GenerationStatus.PENDING,
        last_seen_at=datetime.now(timezone.utc),
    )
    # Chosen here rather than read back from Celery, which is what lets the id
    # be stored in the same INSERT as the row instead of an UPDATE-and-commit
    # afterwards. Celery accepts the id it is given, so the two agree.
    task_id = str(uuid4())
    generation.celery_task_id = task_id

    try:
        db.add(generation)
        db.flush()

        # Claimed in the same transaction as the generation. A crash between the
        # two would otherwise leave a generation whose worker finds no source
        # material and silently writes a script ignoring the user's documents.
        for attachment in attachments:
            attachment.generation_id = generation.id

        db.commit()

        # Queued only once the row is committed: the worker looks the generation
        # up by id, and a task that overtakes its own row finds nothing there.
        generate_script_task.apply_async(args=[generation.id], task_id=task_id)
    except Exception as exc:
        db.rollback()

        # No usable job was dispatched. Hide the incomplete row so a retry is a
        # clean request rather than a draft the user never received. The
        # attachments are left alone: the rollback un-claimed them, so they are
        # still there for the retry.
        generation.is_deleted = True
        generation.deleted_at = datetime.now(timezone.utc)
        generation.status = GenerationStatus.CANCELLED
        db.commit()

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not queue script generation. Please try again.",
        ) from exc

    return {"generation": serialize_generation(db, generation, versions=0), "reused": False}


# Only every Nth poll actually writes. The client polls every 2s, and the sweep
# it feeds runs on a 10-minute horizon, so a heartbeat this coarse is still two
# orders of magnitude more precise than it needs to be — while a write per poll
# would mean a row update every 2 seconds per watching client, each one also
# bumping `updated_at` and reshuffling the drafts list under the user.
HEARTBEAT_INTERVAL = timedelta(seconds=30)


def touch_generation(generation: ScriptGeneration, db: Session) -> None:
    """Record that a client is still watching. The stale sweep terminates jobs
    nobody has asked about — see script_tasks.sweep_stale_generations — so
    forgetting to call this on a polling path would kill live generations."""
    now = datetime.now(timezone.utc)
    last_seen = generation.last_seen_at
    if last_seen is not None:
        # Rows written by the DB default come back naive on some drivers;
        # comparing those to an aware `now` raises rather than returning False.
        if last_seen.tzinfo is None:
            last_seen = last_seen.replace(tzinfo=timezone.utc)
        if now - last_seen < HEARTBEAT_INTERVAL:
            return

    generation.last_seen_at = now
    db.commit()


def get_generation_status(generation_id: int, current_user: User, db: Session) -> dict:
    row = (
        db.query(ScriptGeneration)
        .filter(
            ScriptGeneration.id == generation_id,
            ScriptGeneration.user_id == current_user.id,
            ScriptGeneration.is_deleted == False,  # noqa: E712
        )
        .one_or_none()
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Script not found")

    touch_generation(row, db)

    cached = read_script_status(generation_id)
    if cached is not None:
        return cached

    # Cache miss — the task hasn't written its first status yet, or the key's TTL
    # expired long after the run finished. Postgres is the fallback either way.
    if row.status == GenerationStatus.COMPLETED:
        return {
            "status": "completed",
            "title": row.title,
            "script": row.script,
            "generation_id": row.id,
        }
    if row.status == GenerationStatus.FAILED:
        return {"status": "failed", "error": row.error}
    return {"status": row.status.value}


def request_revision(
    generation_id: int, payload: ScriptReviseRequest, current_user: User, db: Session
) -> dict:
    """AI revision is gone for now — see deck_controller.request_script_revision
    for the why. Manual edits (PATCH /scripts/{id}) still work and still append
    a version, so the undo history is unaffected."""
    get_generation(generation_id, current_user, db)
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Script revision is temporarily unavailable.",
    )


def edit_script(
    generation_id: int, payload: ScriptEditRequest, current_user: User, db: Session
) -> dict:
    """Manual edit from the script editor. Synchronous — no AI — but still
    appends a version, so an edit is undoable on the same arrows as a revision."""
    generation = get_generation(generation_id, current_user, db)

    if generation.status in (GenerationStatus.PENDING, GenerationStatus.PROCESSING):
        # The Celery job is about to write this same column; letting the edit
        # through would either be clobbered by the worker or lost.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The script is still generating — wait for it to finish before editing it.",
        )

    generation.script = payload.script
    if payload.title:
        generation.title = payload.title

    append_version(
        db,
        generation,
        title=generation.title or "",
        script=payload.script,
        kind=ScriptVersionKind.EDITED,
    )
    db.commit()
    db.refresh(generation)

    # The status endpoint answers from Redis first, so a stale cached payload
    # would keep serving the pre-edit script until the TTL expired.
    write_script_status(
        generation_id,
        {
            "status": "completed",
            "title": generation.title,
            "script": generation.script,
            "generation_id": generation.id,
        },
    )

    return serialize_generation(db, generation)


def restore_version(
    generation_id: int, version_id: int, current_user: User, db: Session
) -> dict:
    """
    Undo/redo. Moving the cursor to an older version makes that script current
    again — without deleting anything after it, so redo is just restoring a
    later version.

    Restoring does not append a version. A user stepping back and forth through
    their history would otherwise generate a new history entry per tap, and the
    undo stack would grow every time it was used.
    """
    generation = get_generation(generation_id, current_user, db)

    version = (
        db.query(ScriptVersion)
        .filter(ScriptVersion.id == version_id, ScriptVersion.generation_id == generation.id)
        .one_or_none()
    )
    if version is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")
    if generation.status in (GenerationStatus.PENDING, GenerationStatus.PROCESSING):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The script is still generating — wait for it to finish.",
        )

    generation.script = version.script
    generation.title = version.title or generation.title
    db.commit()
    db.refresh(generation)

    write_script_status(
        generation_id,
        {
            "status": "completed",
            "title": generation.title,
            "script": generation.script,
            "generation_id": generation.id,
        },
    )

    return serialize_generation(db, generation)


def list_versions(generation_id: int, current_user: User, db: Session) -> list[ScriptVersion]:
    generation = get_generation(generation_id, current_user, db)
    return (
        db.query(ScriptVersion)
        .filter(ScriptVersion.generation_id == generation.id)
        .order_by(ScriptVersion.position.asc())
        .all()
    )


def cancel_generation(generation_id: int, current_user: User, db: Session) -> dict:
    """Explicit Stop, or the client leaving for home / backgrounding. Parks the
    generation in CANCELLED, which is recoverable: the brief and any previous
    versions survive, and retry re-runs from here."""
    generation = get_generation(generation_id, current_user, db)

    if generation.status not in (GenerationStatus.PENDING, GenerationStatus.PROCESSING):
        # Nothing running — usually the job finished between the last poll and
        # the tap. "Stop something already stopped" succeeded, from the user's
        # side, so report the generation as-is rather than erroring.
        return serialize_generation(db, generation)

    _revoke(generation.celery_task_id)

    generation.status = GenerationStatus.CANCELLED
    generation.error = None
    db.commit()
    db.refresh(generation)

    # Attachments deliberately survive a cancel. Retry re-runs this same
    # generation against the same brief, and a retry that had lost the user's
    # source documents would quietly produce a different, ungrounded script.
    write_script_status(generation_id, {"status": "cancelled"})
    return serialize_generation(db, generation)


def retry_generation(generation_id: int, current_user: User, db: Session) -> dict:
    """Re-run the same brief on the same generation, so a failed or cancelled run
    doesn't leave a dead draft behind and the id the app is holding stays valid."""
    generation = get_generation(generation_id, current_user, db)

    if generation.status in (GenerationStatus.PENDING, GenerationStatus.PROCESSING):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="This script is already generating."
        )

    generation.status = GenerationStatus.PENDING
    generation.error = None
    generation.last_seen_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(generation)

    write_script_status(generation_id, {"status": "pending"})

    task = generate_script_task.delay(generation.id)
    generation.celery_task_id = task.id
    db.commit()
    db.refresh(generation)

    return serialize_generation(db, generation)


def list_generations(
    current_user: User, db: Session, *, include_materialized: bool = False
) -> list[dict]:
    """
    The drafts list: scripts that were generated but never turned into a deck.

    This is where an abandoned generation goes instead of becoming a deck with no
    cards. A run the user walked away from mid-generation shows up here too, which
    is the point — the work isn't lost just because they left the screen.
    """
    query = db.query(ScriptGeneration).filter(
        ScriptGeneration.user_id == current_user.id,
        ScriptGeneration.is_deleted == False,  # noqa: E712
    )
    if not include_materialized:
        query = query.filter(ScriptGeneration.deck_id.is_(None))

    generations = query.order_by(ScriptGeneration.updated_at.desc()).all()
    return [
        {
            "id": g.id,
            "description": g.description,
            "duration_mins": g.duration_mins,
            "card_count": g.card_count,
            "audience": g.audience,
            "title": g.title,
            "status": g.status,
            "deck_id": g.deck_id,
            "version_count": version_count(db, g.id),
            "created_at": g.created_at,
            "updated_at": g.updated_at,
        }
        for g in generations
    ]


def discard_generation(generation_id: int, current_user: User, db: Session) -> None:
    """User threw the draft away. Soft delete, and kill any job still running for
    it — otherwise a worker keeps paying the provider to finish a script that
    already has no home."""
    generation = get_generation(generation_id, current_user, db)

    _revoke(generation.celery_task_id)
    _revoke(generation.cards_celery_task_id)

    generation.is_deleted = True
    generation.deleted_at = datetime.now(timezone.utc)
    if generation.status in (GenerationStatus.PENDING, GenerationStatus.PROCESSING):
        generation.status = GenerationStatus.CANCELLED
    db.commit()

    _purge_generation_attachments(generation_id, db)
    clear_script_status(generation_id)


def request_deck_creation(generation_id: int, current_user: User, db: Session) -> dict:
    """
    Accept the script: queue the job that generates the cards and then creates
    the deck.

    Nothing is created here. Tapping Create used to insert the deck immediately
    and generate cards into it, so an empty deck appeared in the grid the instant
    the button was pressed and stayed there — forever, if the job failed. The
    deck is now written together with its cards, at the end of
    build_deck_from_generation, so it can't be seen before its cards exist.

    Idempotent: a second tap while the job is running returns the running job,
    and once it's done it returns the deck that was built.
    """
    generation = get_generation(generation_id, current_user, db)

    if generation.deck_id is not None:
        deck = db.query(Deck).filter(Deck.id == generation.deck_id).one_or_none()
        if deck is not None and not deck.is_deleted:
            return {"generation_id": generation.id, "status": "completed", "deck_id": deck.id}
        # The deck was deleted out from under the generation; fall through and
        # build a new one rather than refusing a draft that's perfectly valid.
        generation.deck_id = None
        db.commit()

    if generation.status != GenerationStatus.COMPLETED or not generation.script:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This script hasn't finished generating yet.",
        )

    # "Already building" has to mean dispatched, not merely PENDING.
    #
    # cards_status is PENDING from the moment the row is created — it's the
    # column default — so a status-only check treats a generation nobody has ever
    # tapped Create on as one that's already building, returns "in progress", and
    # queues nothing. The client then polls a job that does not exist, forever.
    # cards_celery_task_id is the honest marker: it is set only after .delay()
    # has actually handed the job to a worker.
    is_dispatched = generation.cards_celery_task_id is not None
    if is_dispatched and generation.cards_status in (
        GenerationStatus.PENDING,
        GenerationStatus.PROCESSING,
    ):
        # A genuine double tap. Returning the in-flight job rather than 409ing
        # means it's harmless instead of an error the user has to read.
        return {
            "generation_id": generation.id,
            "status": generation.cards_status.value,
            "deck_id": None,
        }

    # Fail fast with a clear message if card_count doesn't fit the script, rather
    # than letting the task discover it after the user has left the screen.
    try:
        split_script_into_segments(generation.script, generation.card_count)
    except CardGenerationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    generation.cards_status = GenerationStatus.PENDING
    generation.cards_error = None
    db.commit()

    write_generation_cards_status(generation_id, {"status": "pending"})

    task = build_deck_from_generation.delay(generation.id)
    generation.cards_celery_task_id = task.id
    db.commit()

    return {"generation_id": generation.id, "status": "pending", "deck_id": None}


def get_deck_creation_status(generation_id: int, current_user: User, db: Session) -> dict:
    generation = get_generation(generation_id, current_user, db)
    touch_generation(generation, db)

    cached = read_generation_cards_status(generation_id)
    if cached is not None:
        return cached

    if generation.deck_id is not None:
        return {"status": "completed", "deck_id": generation.deck_id}
    if generation.cards_status == GenerationStatus.FAILED:
        return {"status": "failed", "error": generation.cards_error}
    return {"status": generation.cards_status.value}


def cancel_deck_creation(generation_id: int, current_user: User, db: Session) -> dict:
    """Stop the card job. Nothing has been written yet, so unlike the old flow
    there are no half-populated decks or orphaned cards to clean up — the
    generation simply goes back to being a draft."""
    generation = get_generation(generation_id, current_user, db)

    if generation.cards_status in (GenerationStatus.PENDING, GenerationStatus.PROCESSING):
        _revoke(generation.cards_celery_task_id)
        generation.cards_status = GenerationStatus.CANCELLED
        generation.cards_error = None
        db.commit()
        write_generation_cards_status(generation_id, {"status": "cancelled"})

    return {
        "generation_id": generation.id,
        "status": generation.cards_status.value,
        "deck_id": generation.deck_id,
    }
