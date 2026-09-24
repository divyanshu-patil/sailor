from fastapi import APIRouter, HTTPException, Query, Response

from app.schemas.onboarding_demo_schema import DemoDetail, DemoOption
from app.services import onboarding_demos

router = APIRouter(prefix="/onboarding-demos", tags=["Onboarding"])

#: The demos only change when someone regenerates and redeploys them, so any
#: cache between here and the phone may keep them for a day.
CACHE_CONTROL = "public, max-age=86400"


@router.get(
    "",
    response_model=list[DemoOption],
    summary="List onboarding demos",
    description=(
        "Public — onboarding runs before sign-up. Demos for the given speaking "
        "contexts come first; the rest of the catalogue fills the list."
    ),
)
def list_demos(
    response: Response,
    contexts: str = Query(
        "",
        description="Comma-separated speaking contexts, e.g. `work,interviews`.",
    ),
    limit: int = Query(onboarding_demos.DEFAULT_LIMIT, ge=1, le=12),
):
    response.headers["Cache-Control"] = CACHE_CONTROL
    wanted = [c.strip() for c in contexts.split(",") if c.strip()]
    return onboarding_demos.list_options(wanted, limit)


@router.get(
    "/{demo_id}",
    response_model=DemoDetail,
    summary="Get an onboarding demo",
    description="The stored script and deck for one demo. Public.",
)
def get_demo(demo_id: str, response: Response):
    demo = onboarding_demos.get_demo(demo_id)
    if demo is None:
        raise HTTPException(status_code=404, detail="Demo not found")
    response.headers["Cache-Control"] = CACHE_CONTROL
    return demo
