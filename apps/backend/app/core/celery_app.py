from celery import Celery
from celery.schedules import crontab

from app.config.settings import settings
import app.models

celery_app = Celery(
    "sailor",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.tasks.card_tasks",
        "app.tasks.deck_tasks",
        "app.tasks.script_tasks",
        "app.tasks.daily_tasks",
    ],
)

# One queue per kind of work, because they have completely different shapes and
# starve each other on a shared one: a card job is minutes of model calls, a
# script generation is the thing a user is actively staring at, and the sweeps
# are seconds of maintenance nobody is waiting for. With prefetch=1 and two
# worker slots, two card jobs were enough to leave a script generation queued
# behind them.
#
# The dev worker consumes all three (see package.json), so nothing changes for a
# single-process setup. Scaling out is then a matter of running one worker per
# queue — `celery -A app.core.celery_app worker -Q scripts -c 4` — and giving
# the user-facing one the concurrency.
QUEUE_SCRIPTS = "scripts"
QUEUE_CARDS = "cards"
QUEUE_MAINTENANCE = "maintenance"

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    # Script generation takes real time (seconds to a couple minutes) — don't let a
    # worker grab a big batch of these upfront, and don't lose a job if a worker
    # crashes mid-generation.
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    # A script generation fans out to one concurrent AI call per beat, and cards
    # to one per batch, so a single task holds several sockets open at once. The
    # default soft/hard time limits are generous enough for that, but a hung
    # provider connection would otherwise pin a worker slot indefinitely.
    task_soft_time_limit=600,
    task_time_limit=660,
    # Default for a task with no explicit route — nothing should land here, but
    # a new task that forgets its route still runs rather than sitting unqueued.
    task_default_queue=QUEUE_SCRIPTS,
    task_routes={
        "app.tasks.script_tasks.generate_script_task": {"queue": QUEUE_SCRIPTS},
        "app.tasks.script_tasks.revise_script_task": {"queue": QUEUE_SCRIPTS},
        # Revising a deck someone is looking at is user-facing work, so it
        # shares the queue with generation rather than waiting behind cards.
        "app.tasks.deck_tasks.revise_deck_script": {"queue": QUEUE_SCRIPTS},
        "app.tasks.script_tasks.build_deck_from_generation": {"queue": QUEUE_CARDS},
        "app.tasks.card_tasks.*": {"queue": QUEUE_CARDS},
        "app.tasks.script_tasks.sweep_stale_generations": {"queue": QUEUE_MAINTENANCE},
        "app.tasks.script_tasks.sweep_orphan_attachments": {"queue": QUEUE_MAINTENANCE},
        # Nobody is waiting on it: the buffer is days ahead of the user.
        "app.tasks.daily_tasks.refill_daily_content": {"queue": QUEUE_MAINTENANCE},
    },
    worker_concurrency=settings.CELERY_WORKER_CONCURRENCY,
    # Bounds the memory a long-lived worker can leak through an SDK or parser.
    worker_max_tasks_per_child=settings.CELERY_MAX_TASKS_PER_CHILD,
    # Results are written to Redis and never read — the app polls the generation
    # row and its status key instead. Without this they accumulate forever.
    result_expires=settings.CELERY_RESULT_EXPIRES,
    # Redis re-delivers a task whose worker went quiet for longer than this.
    # It has to stay comfortably above task_time_limit or a slow-but-healthy
    # generation gets handed to a second worker while the first is still on it.
    broker_transport_options={"visibility_timeout": 3600},
    # Celery 6 stops retrying the broker at startup by default; the worker and
    # the API come up alongside Redis in compose, so losing that race should be
    # a retry, not a crash.
    broker_connection_retry_on_startup=True,
    # Task events, so `celery -A app.core.celery_app flower` (or events) can see
    # what a worker is doing without adding logging to every task.
    worker_send_task_events=True,
    task_send_sent_event=True,
    beat_schedule={
        # Backing out of the preview screen deliberately no longer cancels a
        # generation. The cost is a job with nobody waiting for it whenever the
        # app is killed outright — neither the home-screen nor the background
        # cancel can catch that — so this sweeps them up server-side. See
        # script_tasks.sweep_stale_generations.
        "sweep-stale-script-generations": {
            "task": "app.tasks.script_tasks.sweep_stale_generations",
            "schedule": crontab(minute="*/5"),
        },
        # Separate from the sweep above, and far less often: an attachment is
        # only an orphan once it is 24 hours old, and the stale sweep now skips
        # the database entirely when nothing has been generated recently — which
        # would have taken this with it.
        "sweep-orphan-attachments": {
            "task": "app.tasks.script_tasks.sweep_orphan_attachments",
            "schedule": crontab(minute="17"),
        },
        # Hourly, not nightly. The task only generates days that are missing, so
        # a full buffer costs one query — and an hourly beat means a day that
        # failed its model call retries within the hour instead of tomorrow.
        "refill-daily-practice-content": {
            "task": "app.tasks.daily_tasks.refill_daily_content",
            "schedule": crontab(minute="9"),
        },
    },
)