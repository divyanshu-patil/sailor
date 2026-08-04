from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.controllers import script_controller
from app.db.database import get_db
from app.models.user_model import User
from app.schemas.script_schema import (
    DeckBuildStatusResponse,
    ScriptEditRequest,
    ScriptGenerateRequest,
    ScriptGenerationResponse,
    ScriptGenerationSummary,
    ScriptReviseRequest,
    ScriptStartResponse,
    ScriptVersionResponse,
)

router = APIRouter(prefix="/scripts", tags=["Scripts"])


@router.get("/health")
def health_check():
    """Simple health check — no auth required."""
    return {"status": "ok", "service": "script-router"}


@router.post("", response_model=ScriptStartResponse, status_code=status.HTTP_201_CREATED)
def start_generation(
    payload: ScriptGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Queue a script generation. No deck is created here — that only happens at
    POST /scripts/{id}/deck, once the user accepts the result.

    JSON, not multipart: files are uploaded ahead of the brief via
    POST /attachments and referenced here by id, which is what lets the wizard
    report per-file progress and hold its Next button until they land.

    Resubmitting an unchanged brief returns the generation that already exists
    with `reused: true`, rather than starting a second identical job.
    """
    return script_controller.start_generation(payload, current_user, db)


@router.get("", response_model=list[ScriptGenerationSummary])
def list_generations(
    include_materialized: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Drafts: every script that hasn't become a deck, including runs the user
    walked away from mid-generation."""
    return script_controller.list_generations(
        current_user, db, include_materialized=include_materialized
    )


@router.get("/{generation_id}", response_model=ScriptGenerationResponse)
def get_generation(
    generation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    generation = script_controller.get_generation(generation_id, current_user, db)
    return script_controller.serialize_generation(db, generation)


@router.get("/{generation_id}/status")
def get_generation_status(
    generation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Poll target. Also the heartbeat: each call marks the generation as still
    being watched, which is what keeps the stale sweep from terminating it."""
    return script_controller.get_generation_status(generation_id, current_user, db)


@router.patch("/{generation_id}", response_model=ScriptGenerationResponse)
def edit_script(
    generation_id: int,
    payload: ScriptEditRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Manual edit — synchronous, and appended to the version history so it can
    be undone alongside AI revisions."""
    return script_controller.edit_script(generation_id, payload, current_user, db)


@router.post(
    "/{generation_id}/revise",
    response_model=ScriptGenerationResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def revise_script(
    generation_id: int,
    payload: ScriptReviseRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """AI rewrite. Async — poll /status, same as the initial generation."""
    return script_controller.request_revision(generation_id, payload, current_user, db)


@router.get("/{generation_id}/versions", response_model=list[ScriptVersionResponse])
def list_versions(
    generation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Oldest first. This is the undo/redo stack the preview screen's arrows
    step through."""
    return script_controller.list_versions(generation_id, current_user, db)


@router.post(
    "/{generation_id}/versions/{version_id}/restore",
    response_model=ScriptGenerationResponse,
)
def restore_version(
    generation_id: int,
    version_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Make an earlier version current again. Nothing is deleted, so stepping
    forward again is just restoring a later version."""
    return script_controller.restore_version(generation_id, version_id, current_user, db)


@router.post("/{generation_id}/cancel", response_model=ScriptGenerationResponse)
def cancel_generation(
    generation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Stop an in-flight job at the provider. Called on an explicit Stop, and
    when the app leaves for home or goes to the background — never on a plain
    back out of the preview screen."""
    return script_controller.cancel_generation(generation_id, current_user, db)


@router.post(
    "/{generation_id}/retry",
    response_model=ScriptGenerationResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def retry_generation(
    generation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """"Try again" after a failed or cancelled run — re-queues the same brief on
    the same generation."""
    return script_controller.retry_generation(generation_id, current_user, db)


@router.post(
    "/{generation_id}/deck",
    response_model=DeckBuildStatusResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def create_deck(
    generation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Accept the script: queue card generation, which creates the deck once the
    cards are ready.

    202, not 201 — no deck exists yet, and deliberately so. Creating it up front
    put an empty deck in the user's grid the moment they tapped Create. Poll
    /{id}/deck/status for the deck id. Idempotent: a second call returns the
    running job, or the deck if it already finished.
    """
    return script_controller.request_deck_creation(generation_id, current_user, db)


@router.get("/{generation_id}/deck/status", response_model=DeckBuildStatusResponse)
def get_deck_status(
    generation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Poll target for deck creation. `deck_id` is null until the cards are
    written and the deck exists."""
    return script_controller.get_deck_creation_status(generation_id, current_user, db)


@router.post("/{generation_id}/deck/cancel", response_model=DeckBuildStatusResponse)
def cancel_deck_creation(
    generation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Stop card generation. Nothing has been written yet, so this leaves the
    generation as a draft rather than a half-built deck."""
    return script_controller.cancel_deck_creation(generation_id, current_user, db)


@router.delete("/{generation_id}", status_code=status.HTTP_204_NO_CONTENT)
def discard_generation(
    generation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Throw the draft away, killing any job still running for it."""
    script_controller.discard_generation(generation_id, current_user, db)
