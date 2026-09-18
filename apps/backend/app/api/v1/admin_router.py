import hmac
import logging

from fastapi import APIRouter, Header, HTTPException, Query, Request

from app.config.settings import settings
from app.tasks.daily_tasks import BUFFER_DAYS, refill_daily_content

logger = logging.getLogger("uvicorn.error")

# `include_in_schema=False` on the route below keeps this out of /docs and out
# of the OpenAPI document the mobile client is generated against. It is an ops
# tool, called by hand (curl, or `pnpm daily-practice:regenerate`), never by the
# app.
router = APIRouter(prefix="/admin", tags=["Admin"])


@router.post("/daily-content/regenerate", include_in_schema=False)
def regenerate_daily_content(
    request: Request,
    days: int = Query(
        BUFFER_DAYS,
        ge=1,
        le=30,
        description="How many days ahead to regenerate. Defaults to the normal buffer.",
    ),
    override_today: bool = Query(
        False,
        description=(
            "Also replace today's content. Off by default so a regeneration "
            "never swaps the snippet out from under someone mid-practice."
        ),
    ),
    x_admin_secret: str = Header(..., alias="X-Admin-Secret"),
) -> dict:
    """Force-regenerate the daily content buffer.

    Discards and rebuilds the next `days` days, for when the prompt or the
    framework library changed and the buffered content is stale rather than
    missing. The normal refill only fills gaps, so it would leave that content
    in place indefinitely.

    Today is preserved unless `override_today` is set — see the task.
    """
    configured = settings.DAILY_PRACTICE_ADMIN_SECRET

    # An unset secret closes the route instead of opening it. Checked before the
    # comparison so `compare_digest("", "")` can never succeed.
    if not configured:
        logger.warning(
            "[admin] daily-content regeneration attempted but "
            "DAILY_PRACTICE_ADMIN_SECRET is not configured — refusing"
        )
        raise HTTPException(status_code=404, detail="Not found")

    # Constant-time. A plain `==` returns as soon as two bytes differ, and the
    # timing difference is enough to recover the secret one character at a time.
    if not hmac.compare_digest(x_admin_secret, configured):
        # The secret itself is never logged — only that someone tried, and from
        # where. `client.host` is the proxy's address unless the deployment sets
        # forwarded headers.
        source = request.client.host if request.client else "unknown"
        logger.warning(f"[admin] rejected daily-content regeneration from {source}")
        raise HTTPException(status_code=401, detail="Invalid secret")

    source = request.client.host if request.client else "unknown"
    logger.info(
        f"[admin] daily-content regeneration accepted from {source}, "
        f"days={days}, override_today={override_today}"
    )

    # Queued on Celery rather than run in a FastAPI BackgroundTask: this is
    # minutes of model calls, and a BackgroundTask would run them inside the API
    # process, holding a worker and dying with a deploy. The task logs its own
    # start, per-day failures and completion under the "celery" logger.
    refill_daily_content.delay(days=days, force=True, override_today=override_today)

    return {
        "status": "regeneration started",
        "days": days,
        "overrideToday": override_today,
    }
