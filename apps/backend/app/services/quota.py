"""
Server-side generation quota — the monetization boundary.

The client hides the create flow behind a paywall, but a client-side gate is a
suggestion: every endpoint that queues a model call is reachable with nothing
but a valid Clerk token. This module is what actually stops an account from
spending AI budget it hasn't paid for, so every path that dispatches a
generation task calls `consume_generation` before it queues anything.

Two facts have to be true before a generation is allowed, and neither of them
can come from the request body:

  * the user's **tier**, which RevenueCat owns, not us. Read from RevenueCat's
    REST API and cached on the user row — the alternative, trusting whatever
    entitlement the client claims, is the exact hole this module closes.
  * the user's **usage this period**, a counter on the same row, checked and
    incremented in one atomic UPDATE so two requests arriving together can't
    both spend the last remaining credit.
"""

import logging
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config.settings import settings
from app.models.user_model import SubscriptionTier, User

logger = logging.getLogger("celery")

# A rolling 30 days from the user's first generation, not a calendar month.
# Nothing has to run on a schedule to reset it — the check below rolls the
# window forward the first time a request arrives after it has expired, which is
# the only moment the value is ever read.
PERIOD = timedelta(days=30)

# How long a cached tier is trusted. Short enough that a lapsed subscription
# stops costing us within the quarter hour; long enough that the common case
# (generate, revise, accept, all within one sitting) is a single lookup. A fresh
# *upgrade* doesn't wait this out — see consume_generation.
ENTITLEMENT_TTL = timedelta(minutes=15)

REVENUECAT_TIMEOUT = 5.0
REVENUECAT_SUBSCRIBER_URL = "https://api.revenuecat.com/v1/subscribers/{app_user_id}"


def limit_for(tier: SubscriptionTier) -> int:
    """Generations per period, or -1 for unlimited — which is what both tiers
    are configured to today.

    Generation is deliberately not the thing Sailors meters: a person deciding
    whether to rewrite their talk one more time should be thinking about the
    talk, not about credits. The machinery below stays in place because the
    counter is still worth having (it is how we see what a user actually costs)
    and because a ceiling may be needed later for abuse rather than for
    pricing — at which point it is one env var, not a code change."""
    if tier == SubscriptionTier.SKETOS:
        return settings.FREE_MONTHLY_GENERATIONS
    return settings.PRO_MONTHLY_GENERATIONS


# ---------------------------------------------------------------------------
# Tier — owned by RevenueCat, cached here
# ---------------------------------------------------------------------------


def _tier_from_entitlements(entitlements: dict) -> SubscriptionTier:
    """Map a RevenueCat subscriber's entitlements onto our tier enum.

    Pure, and separated from the HTTP call for exactly that reason — this is the
    part with branches in it, and the part that is wrong in a way no error
    surfaces (a lapsed subscriber quietly reading as paid).

    A trial needs no special case: RevenueCat gives it a real `expires_date`
    like any other subscription, and an active trial *is* paid access right up
    until the day it lapses. The distinction only matters if trial limits ever
    diverge from paid ones, which today they don't.
    """
    entitlement = entitlements.get(settings.REVENUECAT_ENTITLEMENT_ID)
    if not entitlement:
        return SubscriptionTier.SKETOS

    expires = entitlement.get("expires_date")
    # Null expiry is a lifetime grant — a non-consumable or a promo with no end.
    if expires is None:
        return SubscriptionTier.METRIOS

    try:
        expires_at = datetime.fromisoformat(expires.replace("Z", "+00:00"))
    except (AttributeError, ValueError):
        # An expiry we can't read is not an expiry we can honour. Fail closed:
        # the user drops to free rather than getting unbounded access from a
        # date format change.
        logger.warning(f"[quota] unparseable expires_date from RevenueCat: {expires!r}")
        return SubscriptionTier.SKETOS

    return (
        SubscriptionTier.METRIOS
        if expires_at > datetime.now(timezone.utc)
        else SubscriptionTier.SKETOS
    )


def _fetch_tier(clerk_user_id: str) -> SubscriptionTier | None:
    """Ask RevenueCat. None means "couldn't reach it", which is distinct from
    "this user has nothing" — the caller treats the two very differently.

    The RevenueCat app user id is the Clerk user id: the mobile client calls
    `Purchases.logIn(clerkId)` (see mobile app/lib/purchases.ts), which is what
    makes this lookup possible from a Clerk token alone.
    """
    try:
        response = httpx.get(
            REVENUECAT_SUBSCRIBER_URL.format(app_user_id=clerk_user_id),
            headers={"Authorization": f"Bearer {settings.REVENUECAT_API_KEY}"},
            timeout=REVENUECAT_TIMEOUT,
        )
    except httpx.HTTPError as exc:
        logger.warning(f"[quota] RevenueCat unreachable: {exc}")
        return None

    # 404 is an answer, not a failure: RevenueCat has never seen this user, so
    # they have never bought anything.
    if response.status_code == 404:
        return SubscriptionTier.SKETOS
    if response.status_code != 200:
        logger.warning(f"[quota] RevenueCat returned {response.status_code}")
        return None

    subscriber = response.json().get("subscriber") or {}
    return _tier_from_entitlements(subscriber.get("entitlements") or {})


def resolve_tier(user: User, db: Session, *, force: bool = False) -> SubscriptionTier:
    """The user's tier, served from the cached column unless it has gone stale.

    With no API key configured — local dev, tests, CI — the column stands on its
    own. Enforcement still runs; it just runs against whatever the row says,
    which is what lets a developer promote themselves with one UPDATE instead of
    a sandbox purchase.
    """
    if not settings.REVENUECAT_API_KEY:
        return user.subscription_tier

    checked_at = user.entitlement_checked_at
    if (
        not force
        and checked_at is not None
        and datetime.now(timezone.utc) - checked_at < ENTITLEMENT_TTL
    ):
        return user.subscription_tier

    tier = _fetch_tier(user.clerk_user_id)
    if tier is None:
        # A network blip must not downgrade a paying customer mid-sentence. The
        # cached tier stands and the timestamp is deliberately left stale, so
        # the next request retries instead of waiting out the whole TTL.
        return user.subscription_tier

    user.subscription_tier = tier
    user.entitlement_checked_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    return tier


# ---------------------------------------------------------------------------
# Usage — checked and incremented in one statement
# ---------------------------------------------------------------------------

# Read-then-write in Python would let two requests both read "2 of 3 used" and
# both proceed. This is the whole gate as a single statement: the WHERE clause
# is the check, the SET is the spend, and Postgres serialises the two for us.
# The CASE arms are the period roll — an expired window resets to 1 (this
# request) in the same breath, so no scheduled job has to exist.
_CONSUME_SQL = text(
    """
    UPDATE users
       SET monthly_generations_used = CASE
               WHEN usage_period_started_at < :cutoff THEN 1
               ELSE monthly_generations_used + 1 END,
           usage_period_started_at = CASE
               WHEN usage_period_started_at < :cutoff THEN now()
               ELSE usage_period_started_at END
     WHERE id = :user_id
       AND (usage_period_started_at < :cutoff
            OR :limit < 0
            OR monthly_generations_used < :limit)
 RETURNING monthly_generations_used
    """
)


def _try_consume(user: User, limit: int, db: Session) -> bool:
    cutoff = datetime.now(timezone.utc) - PERIOD
    used = db.execute(
        _CONSUME_SQL, {"user_id": user.id, "limit": limit, "cutoff": cutoff}
    ).scalar()
    db.commit()
    # The row changed underneath the ORM's copy of it, and callers read
    # `monthly_generations_used` off that copy straight afterwards.
    db.refresh(user)
    return used is not None


def consume_generation(user: User, db: Session) -> None:
    """Spend one generation credit, or refuse the request.

    Call this *before* queueing any task that will make model calls, and pair a
    `refund_generation` with any path that charges and then fails to dispatch.
    """
    tier = resolve_tier(user, db)
    if _try_consume(user, limit_for(tier), db):
        return

    # Out of credits on the tier we had cached — the one moment a stale cache
    # actually costs somebody something. A user who upgraded ninety seconds ago
    # is still SKETOS here, so ask RevenueCat before telling them no.
    upgraded = resolve_tier(user, db, force=True)
    if upgraded != tier and _try_consume(user, limit_for(upgraded), db):
        return

    limit = limit_for(upgraded)
    resets_at = user.usage_period_started_at + PERIOD
    message = (
        f"You've used all {limit} free generations. Upgrade to Pro to keep going."
        if upgraded == SubscriptionTier.SKETOS
        else f"You've hit this period's limit of {limit} generations."
    )
    raise HTTPException(
        status_code=status.HTTP_402_PAYMENT_REQUIRED,
        detail={
            "code": "generation_quota_exceeded",
            "message": message,
            "tier": upgraded.value,
            "limit": limit,
            "used": user.monthly_generations_used,
            "resets_at": resets_at.isoformat(),
        },
    )


def refund_generation(user: User, db: Session) -> None:
    """Hand a credit back when the work it paid for never started. A broker that
    wouldn't take the job is our failure, and charging for it is how a user ends
    up out of credits having never seen a script."""
    db.execute(
        text(
            "UPDATE users SET monthly_generations_used = GREATEST(0, monthly_generations_used - 1)"
            " WHERE id = :user_id"
        ),
        {"user_id": user.id},
    )
    db.commit()
    db.refresh(user)
