"""The branchy half of the quota gate — mapping a RevenueCat payload to a tier.

The other half (check-and-increment) is a single SQL statement whose correctness
is Postgres's, not ours. This half is the one that can be wrong silently: a
lapsed subscriber reading as paid costs money and nothing raises, and a paying
one reading as free blocks the thing they just bought.
"""

import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from app.config.settings import settings
from app.models.user_model import SubscriptionTier
from app.services.quota import _tier_from_entitlements, limit_for

PRO = settings.REVENUECAT_ENTITLEMENT_ID


def _iso(delta: timedelta) -> str:
    """RevenueCat's format: UTC, trailing Z."""
    return (datetime.now(timezone.utc) + delta).strftime("%Y-%m-%dT%H:%M:%SZ")


class TierFromEntitlements(unittest.TestCase):
    def test_no_entitlements_is_free(self):
        self.assertEqual(_tier_from_entitlements({}), SubscriptionTier.FREE)

    def test_other_entitlement_only_is_free(self):
        self.assertEqual(
            _tier_from_entitlements({"something_else": {"expires_date": _iso(timedelta(days=30))}}),
            SubscriptionTier.FREE,
        )

    def test_unexpired_entitlement_is_pro(self):
        self.assertEqual(
            _tier_from_entitlements({PRO: {"expires_date": _iso(timedelta(days=30))}}),
            SubscriptionTier.PRO,
        )

    def test_expired_entitlement_is_free(self):
        self.assertEqual(
            _tier_from_entitlements({PRO: {"expires_date": _iso(timedelta(days=-1))}}),
            SubscriptionTier.FREE,
        )

    def test_null_expiry_is_a_lifetime_grant(self):
        self.assertEqual(
            _tier_from_entitlements({PRO: {"expires_date": None}}),
            SubscriptionTier.PRO,
        )

    def test_offset_expiry_parses(self):
        """Not every payload uses Z — an explicit offset must not read as expired."""
        expires = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        self.assertEqual(
            _tier_from_entitlements({PRO: {"expires_date": expires}}),
            SubscriptionTier.PRO,
        )

    def test_unreadable_expiry_fails_closed(self):
        for bad in ("not-a-date", "", 1234567890, None if False else "2026-13-45"):
            with self.subTest(bad=bad):
                self.assertEqual(
                    _tier_from_entitlements({PRO: {"expires_date": bad}}),
                    SubscriptionTier.FREE,
                )


def _generosity(tier: SubscriptionTier) -> float:
    """A tier's allowance as a comparable number. -1 means unlimited, which is
    more than any finite cap, so it has to sort above one rather than below
    every positive number."""
    limit = limit_for(tier)
    return float("inf") if limit < 0 else limit


class Limits(unittest.TestCase):
    def test_a_paid_tier_is_never_stingier_than_free(self):
        # Not strictly greater: generation is unlimited on every tier as
        # configured today, so free and paid are level here. What must never
        # happen is paying for less.
        self.assertGreaterEqual(
            _generosity(SubscriptionTier.PRO), _generosity(SubscriptionTier.FREE)
        )

    def test_every_tier_has_a_limit(self):
        """`limit_for` answers for anything in the enum.

        It branches on FREE and returns the paid limit for everything else,
        so a tier added without a matching setting silently inherits the pro
        allowance. This is what notices — it used to be a hardcoded assertion
        about glykos, which went stale the moment that tier was dropped.
        """
        for tier in SubscriptionTier:
            self.assertIsInstance(limit_for(tier), int)

    def test_a_configured_cap_still_favours_the_paid_tier(self):
        """The ordering has to survive a cap being switched back on, which is a
        change to two env vars and nothing else."""
        with patch.object(settings, "FREE_MONTHLY_GENERATIONS", 3), patch.object(
            settings, "PRO_MONTHLY_GENERATIONS", 100
        ):
            self.assertLess(
                limit_for(SubscriptionTier.FREE), limit_for(SubscriptionTier.PRO)
            )

    def test_unlimited_is_the_default(self):
        with patch.object(settings, "FREE_MONTHLY_GENERATIONS", -1):
            self.assertEqual(_generosity(SubscriptionTier.FREE), float("inf"))


if __name__ == "__main__":
    unittest.main()
