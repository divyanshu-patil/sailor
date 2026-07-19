from celery import Celery

from app.config.settings import settings

celery_app = Celery(
    "sailor",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.tasks.deck_tasks"],
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
)