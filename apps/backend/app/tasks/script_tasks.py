import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from celery.exceptions import Retry

from app.core.celery_app import celery_app
from app.db.database import SessionLocal
from app.models.card_model import Card
from app.models.deck_model import Deck
from app.models.script_model import ScriptGeneration
from app.services.ai.card_generator import CardGenerationError, generate_cards
from app.services.ai.script_generator import (
    ScriptGenerationError,
    generate_script,
    revise_script,
)
from app.services.cards.impact_colors import assign_colors_by_impact
from app.services.decks.deck_colors import pick_deck_color
from app.services.realtime.script_events import (
    had_recent_generation_activity,
    mark_generation_activity,
    write_generation_cards_status,
    write_script_status,
)
from app.services.scripts.versions import append_version
from app.services.sources import load_generation_sources
from app.utils.enums.deck_enums import GenerationStatus, ScriptVersionKind
from app.utils.enums.speaking_style import SpeakingStyle

logger = logging.getLogger("celery")

# How long a generation may go without its client asking for status before the
# sweep terminates it. Comfortably longer than a normal generation now that the
# beats run concurrently, and longer than a brief app backgrounding — this is
# aimed at the app that was killed mid-generation and is never coming back.
STALE_AFTER = timedelta(minutes=10)


def _status_payload(generation: ScriptGeneration) -> dict:
    return {
        "status": "completed",
        "title": generation.title,
        "script": generation.script,
        "generation_id": generation.id,
    }


@celery_app.task(bind=True, max_retries=3)
def generate_script_task(self, generation_id: int) -> None:
    db = SessionLocal()
    try:
        generation = (
            db.query(ScriptGeneration).filter(ScriptGeneration.id == generation_id).one_or_none()
        )
        if generation is None:
            logger.warning(f"[script_task] generation {generation_id} not found, aborting")
            return

        if generation.status == GenerationStatus.CANCELLED:
            # Cancelled between being queued and being picked up. Returning here
            # rather than flipping to PROCESSING is what stops a stopped job
            # coming back to life on a worker that was busy at the time.
            logger.info(f"[script_task] generation {generation_id} cancelled before start")
            return

        generation.status = GenerationStatus.PROCESSING
        generation.celery_task_id = self.request.id
        db.commit()
        write_script_status(generation_id, {"status": "processing"})
        # Outlives the staleness window, so the sweep can trust its absence.
        mark_generation_activity(int(STALE_AFTER.total_seconds()) * 2)

        try:
            images, source_text = load_generation_sources(generation_id, db)
            title, script_text = generate_script(
                description=generation.description,
                duration_mins=generation.duration_mins,
                audience=generation.audience,
                images=images,
                source_text=source_text,
                links=generation.links,
            )
        except ScriptGenerationError as exc:
            if self.request.retries < self.max_retries:
                write_script_status(
                    generation_id, {"status": "retrying", "attempt": self.request.retries + 1}
                )
                raise self.retry(exc=exc, countdown=min(60, 2 ** self.request.retries * 5))
            raise

        generation.title = title
        generation.script = script_text
        generation.status = GenerationStatus.COMPLETED
        generation.error = None
        append_version(
            db, generation, title=title, script=script_text, kind=ScriptVersionKind.GENERATED
        )
        db.commit()
        # No db.refresh() here. Every round trip to the pooler costs ~0.4s, and
        # this one re-read three columns this function had just written from
        # values it still holds — paid on the user's clock, at the exact moment
        # they are waiting for the script to appear.
        write_script_status(generation_id, _status_payload(generation))

    except Retry:
        raise
    except Exception as exc:
        db.rollback()
        generation = (
            db.query(ScriptGeneration).filter(ScriptGeneration.id == generation_id).one_or_none()
        )
        if generation is None or generation.status == GenerationStatus.CANCELLED:
            # A cancel terminates this task mid-flight, which surfaces here as an
            # ordinary exception. Reporting that as FAILED would overwrite the
            # CANCELLED the cancel endpoint just wrote and show the user an error
            # for something they chose to do.
            return
        generation.status = GenerationStatus.FAILED
        generation.error = str(exc)[:500]
        db.commit()
        write_script_status(generation_id, {"status": "failed", "error": str(exc)[:500]})
    finally:
        db.close()


@celery_app.task(bind=True, max_retries=3)
def revise_script_task(self, generation_id: int, instruction: str) -> None:
    """AI rewrite of a generation's current script. Appends a version rather than
    replacing one, so a revision that made things worse is always one undo away —
    that history is the reason revision lives on the generation and not on a
    single mutable script column."""
    db = SessionLocal()
    original_title: str | None = None
    original_script: str | None = None
    try:
        generation = (
            db.query(ScriptGeneration).filter(ScriptGeneration.id == generation_id).one_or_none()
        )
        if generation is None:
            logger.warning(f"[script_task] generation {generation_id} not found, aborting revision")
            return

        if generation.status == GenerationStatus.CANCELLED:
            logger.info(f"[script_task] generation {generation_id} revision cancelled before start")
            return

        original_title = generation.title
        original_script = generation.script
        generation.status = GenerationStatus.PROCESSING
        generation.celery_task_id = self.request.id
        db.commit()
        write_script_status(generation_id, {"status": "processing"})
        # Outlives the staleness window, so the sweep can trust its absence.
        mark_generation_activity(int(STALE_AFTER.total_seconds()) * 2)

        try:
            _, source_text = load_generation_sources(generation_id, db)
            revised = revise_script(
                script=original_script,
                instruction=instruction,
                title=original_title or "",
                audience=generation.audience,
                source_text=source_text,
                links=generation.links,
            )
        except ScriptGenerationError as exc:
            if self.request.retries < self.max_retries:
                write_script_status(
                    generation_id, {"status": "retrying", "attempt": self.request.retries + 1}
                )
                raise self.retry(exc=exc, countdown=min(60, 2 ** self.request.retries * 5))
            raise

        generation.script = revised
        generation.status = GenerationStatus.COMPLETED
        generation.error = None
        append_version(
            db,
            generation,
            title=original_title or "",
            script=revised,
            kind=ScriptVersionKind.REVISED,
            instruction=instruction,
        )
        db.commit()
        # No db.refresh(): the payload below is built from values this function
        # just wrote and still holds — see the same note in generate_script_task.
        write_script_status(generation_id, _status_payload(generation))

    except Retry:
        raise
    except Exception as exc:
        # A failed revision must not destroy the script the user already had.
        db.rollback()
        generation = (
            db.query(ScriptGeneration).filter(ScriptGeneration.id == generation_id).one_or_none()
        )
        if generation is None:
            return
        was_cancelled = generation.status == GenerationStatus.CANCELLED
        generation.script = original_script
        generation.title = original_title
        if not was_cancelled:
            # Back to COMPLETED, not FAILED: the previous script is intact and
            # still the thing on screen, so the job's state should say "you have
            # a script" with an error attached, not "you have nothing".
            generation.status = GenerationStatus.COMPLETED
            generation.error = str(exc)[:500]
        db.commit()
        if not was_cancelled:
            # Completed *with* an error, and carrying the restored script. A
            # bare "failed" here would be read by the client as "the job has no
            # result", which would take the user's existing script off the
            # screen because a revision of it didn't work out.
            write_script_status(
                generation_id,
                {
                    "status": "completed",
                    "title": generation.title,
                    "script": generation.script,
                    "generation_id": generation.id,
                    "error": str(exc)[:500],
                },
            )
    finally:
        db.close()


# One retry, not three. Batches now retry and self-heal individually inside
# generate_cards, so reaching this level means something the job can't repair —
# and each attempt here re-runs every batch, which is what turned a single flaky
# response into minutes of waiting followed by a failure anyway.
@celery_app.task(bind=True, max_retries=1)
def build_deck_from_generation(self, generation_id: int) -> None:
    """
    Turn an accepted script into a deck — cards first, deck second.

    The order is the point. Card generation used to run against a deck that had
    already been inserted, so tapping Create put an empty deck in the user's grid
    for the whole length of the job, and left one there permanently if the job
    failed. Here the cards are generated while no deck exists, and the deck and
    its cards are written in a single transaction at the end. A deck therefore
    cannot be observed without its cards, and a failed or cancelled run leaves
    nothing behind at all.
    """
    db = SessionLocal()
    try:
        generation = (
            db.query(ScriptGeneration).filter(ScriptGeneration.id == generation_id).one_or_none()
        )
        if generation is None:
            logger.warning(f"[script_task] generation {generation_id} not found, aborting cards")
            return

        if generation.deck_id is not None:
            # Already built — a duplicate delivery, or a retry after the response
            # was lost. Report the existing deck rather than building a second.
            write_generation_cards_status(
                generation_id, {"status": "completed", "deck_id": generation.deck_id}
            )
            return

        if generation.cards_status == GenerationStatus.CANCELLED:
            logger.info(f"[script_task] generation {generation_id} cards cancelled before start")
            return

        generation.cards_status = GenerationStatus.PROCESSING
        generation.cards_celery_task_id = self.request.id
        db.commit()
        write_generation_cards_status(generation_id, {"status": "processing"})

        try:
            card_data = generate_cards(
                script=generation.script, card_count=generation.card_count
            )
        except CardGenerationError as exc:
            if self.request.retries < self.max_retries:
                write_generation_cards_status(
                    generation_id, {"status": "retrying", "attempt": self.request.retries + 1}
                )
                raise self.retry(exc=exc, countdown=min(60, 2 ** self.request.retries * 5))
            raise

        # Everything below is one transaction: the deck, its cards, and the link
        # back from the generation all land together or not at all.
        deck = Deck(
            user_id=generation.user_id,
            title=generation.title,
            description=generation.description,
            script=generation.script,
            card_count=len(card_data),
            duration_mins=generation.duration_mins,
            audience=generation.audience,
            color=pick_deck_color(generation.user_id, db),
            generation_status=GenerationStatus.COMPLETED,
            cards_generation_status=GenerationStatus.COMPLETED,
        )
        db.add(deck)
        db.flush()  # assigns deck.id without committing

        cards = [
            Card(
                deck_id=deck.id,
                position=index + 1,
                title=item["title"],
                description=item["description"],
                keywords=item["keywords"],
                impact=Decimal(str(item["impact"])),
                delivery=SpeakingStyle(item["delivery"]),
                color="#CCCCCC",  # replaced by assign_colors_by_impact below
            )
            for index, item in enumerate(card_data)
        ]
        db.add_all(cards)
        db.flush()

        assign_colors_by_impact(cards)

        generation.deck_id = deck.id
        generation.cards_status = GenerationStatus.COMPLETED
        generation.cards_error = None
        db.commit()

        logger.info(
            f"[script_task] generation {generation_id} -> deck {deck.id} with {len(cards)} cards"
        )
        write_generation_cards_status(
            generation_id, {"status": "completed", "deck_id": deck.id}
        )

    except Retry:
        raise
    except Exception as exc:
        # Nothing partial survives: the deck was never committed, so the failure
        # leaves the generation exactly as it was — a draft the user can retry.
        db.rollback()
        generation = (
            db.query(ScriptGeneration).filter(ScriptGeneration.id == generation_id).one_or_none()
        )
        if generation is None or generation.cards_status == GenerationStatus.CANCELLED:
            return
        generation.cards_status = GenerationStatus.FAILED
        generation.cards_error = str(exc)[:500]
        db.commit()
        write_generation_cards_status(
            generation_id, {"status": "failed", "error": str(exc)[:500]}
        )
    finally:
        db.close()


@celery_app.task
def sweep_stale_generations() -> int:
    """
    Terminate generations whose client stopped listening.

    Backing out of the preview screen no longer cancels anything — that was the
    whole point of the change, since an accidental back used to throw away a
    running job. The cost of that is a job with nobody waiting for it whenever
    the app is killed outright, which neither the home-screen nor the background
    cancel can catch. `last_seen_at` is touched by every status poll, so a
    generation that hasn't been asked about in STALE_AFTER has no client left.

    Returns the number swept, for the beat log.
    """
    from app.controllers.deck_controller import revoke_task

    # Nothing has started in the last STALE_AFTER window, so nothing can have
    # gone stale in it. Returning here is the difference between a five-minute
    # beat that costs one Redis lookup and one that opens a fresh connection to
    # Postgres — ~6s of the ~7s this task was taking to find zero rows.
    if not had_recent_generation_activity():
        return 0

    db = SessionLocal()
    try:
        cutoff = datetime.now(timezone.utc) - STALE_AFTER
        stale = (
            db.query(ScriptGeneration)
            .filter(
                ScriptGeneration.status.in_(
                    [GenerationStatus.PENDING, GenerationStatus.PROCESSING]
                ),
                ScriptGeneration.last_seen_at < cutoff,
            )
            .all()
        )

        for generation in stale:
            logger.info(
                f"[script_task] sweeping stale generation {generation.id} "
                f"(last seen {generation.last_seen_at})"
            )
            revoke_task(generation.celery_task_id)
            generation.status = GenerationStatus.CANCELLED
            generation.error = None
            write_script_status(generation.id, {"status": "cancelled"})
            # Attachments are left in place — a swept generation is retryable,
            # and a retry that lost the user's documents would quietly produce a
            # different script. Orphans are handled below.

        db.commit()
        return len(stale)
    finally:
        db.close()


# A file picked in the wizard and then abandoned — the user backed out, or the
# app was killed — never gets a generation_id, so nothing else will ever clean
# it up. Generous enough that a user who leaves the form open over lunch and
# comes back still has their uploads.
ORPHAN_ATTACHMENT_AFTER = timedelta(hours=24)


@celery_app.task
def sweep_orphan_attachments() -> int:
    """Its own beat, on its own clock.

    This used to ride along with the stale-generation sweep every five minutes,
    which was 288 scans a day for rows that are only eligible once they are 24
    hours old — and it would now be skipped entirely on an idle instance, since
    that sweep returns early when nothing has run. Hourly is still 24x more
    often than the cutoff requires.
    """
    db = SessionLocal()
    try:
        return _sweep_orphan_attachments(db)
    finally:
        db.close()


def _sweep_orphan_attachments(db) -> int:
    """Delete attachments uploaded but never submitted with a brief."""
    from app.models.attachment_model import Attachment
    from app.services.storage_service import AttachmentStorageError, delete_attachment

    cutoff = datetime.now(timezone.utc) - ORPHAN_ATTACHMENT_AFTER
    orphans = (
        db.query(Attachment)
        .filter(Attachment.generation_id.is_(None), Attachment.created_at < cutoff)
        .all()
    )
    for orphan in orphans:
        try:
            delete_attachment(orphan.object_key)
        except AttachmentStorageError as exc:
            # Leave the row: it is the only record of the object, and dropping
            # it here would turn a retryable failure into a permanent leak.
            logger.warning(f"[script_task] could not remove orphan {orphan.id}: {exc}")
            continue
        db.delete(orphan)
    if orphans:
        db.commit()
        logger.info(f"[script_task] swept {len(orphans)} orphan attachment(s)")
    return len(orphans)
