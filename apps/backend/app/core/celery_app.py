from celery import Celery
from celery.schedules import crontab

from app.config.settings import settings
import app.models

celery_app = Celery(
    "sailor",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.tasks.card_tasks", "app.tasks.script_tasks"],
)

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
    },
)