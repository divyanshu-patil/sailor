"""
Read and reset a user's generation quota, for local development.

Exists because without REVENUECAT_API_KEY set — the normal local case — tier is
whatever the users row says, and there is no in-app way to change it. Testing
the paywall boundary otherwise means either a sandbox purchase or hand-written
SQL, and the SQL is easy to get subtly wrong (the counter and the period start
have to move together, or a "reset" user is still locked out until the window
rolls).

    pnpm run quota you@example.com              # show
    pnpm run quota you@example.com --tier pro   # unlock
    pnpm run quota you@example.com --reset      # credits back to zero

Deliberately not an endpoint: this edits the monetization boundary, and the one
thing that must never exist is an authenticated route that grants entitlement.
"""

import argparse
import sys
from datetime import datetime, timezone

from app.config.settings import settings
from app.db.database import SessionLocal
from app.models.user_model import SubscriptionTier, User
from app.services.quota import PERIOD, limit_for

# The tier names are the entitlement's own, so this is a straight lookup now --
# it survives because argparse `choices` wants a container of strings, and this
# keeps the CLI vocabulary pinned to the enum rather than to a second list.
TIERS = {tier.value: tier for tier in SubscriptionTier}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("email", help="the user to act on")
    parser.add_argument("--tier", choices=sorted(TIERS), help="set the subscription tier")
    parser.add_argument(
        "--reset", action="store_true", help="zero the counter and restart the period"
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == args.email).one_or_none()
        if user is None:
            print(f"No user with email {args.email!r}.", file=sys.stderr)
            return 1

        if args.tier:
            user.subscription_tier = TIERS[args.tier]
            # Cleared, not stamped: a hand-set tier must not look like a
            # confirmed one, or it would survive as a cached answer for the
            # whole TTL once an API key does get configured.
            user.entitlement_checked_at = None

        if args.reset:
            user.monthly_generations_used = 0
            # The period has to restart too. Leaving a stale start date means
            # the next request rolls the window and charges 1 against it, which
            # looks like the reset didn't take.
            user.usage_period_started_at = datetime.now(timezone.utc)

        if args.tier or args.reset:
            db.commit()
            db.refresh(user)

        limit = limit_for(user.subscription_tier)
        source = "RevenueCat" if settings.REVENUECAT_API_KEY else "this column (no API key set)"
        print(f"{user.email}")
        print(f"  tier       {user.subscription_tier.value}  — from {source}")
        print(f"  used       {user.monthly_generations_used} of {limit}")
        print(f"  period     started {user.usage_period_started_at:%Y-%m-%d %H:%M %Z}, "
              f"resets {user.usage_period_started_at + PERIOD:%Y-%m-%d}")
        print(f"  confirmed  {user.entitlement_checked_at or 'never'}")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
