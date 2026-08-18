"""The branchy half of the quota gate — mapping a RevenueCat payload to a tier.

The other half (check-and-increment) is a single SQL statement whose correctness
is Postgres's, not ours. This half is the one that can be wrong silently: a
lapsed subscriber reading as paid costs money and nothing raises, and a paying
one reading as free blocks the thing they just bought.
"""

import unittest
from datetime import datetime, timedelta, timezone

from app.config.settings import settings
from app.models.user_model import SubscriptionTier
from app.services.quota import _tier_from_entitlements, limit_for

PRO = settings.REVENUECAT_ENTITLEMENT_ID


def _iso(delta: timedelta) -> str:
    """RevenueCat's format: UTC, trailing Z."""
    return (datetime.now(timezone.utc) + delta).strftime("%Y-%m-%dT%H:%M:%SZ")


class TierFromEntitlements(unittest.TestCase):
    def test_no_entitlements_is_free(self):
        self.assertEqual(_tier_from_entitlements({}), SubscriptionTier.SKETOS)

    def test_other_entitlement_only_is_free(self):
        self.assertEqual(
            _tier_from_entitlements({"something_else": {"expires_date": _iso(timedelta(days=30))}}),
            SubscriptionTier.SKETOS,
        )

    def test_unexpired_entitlement_is_pro(self):
        self.assertEqual(
            _tier_from_entitlements({PRO: {"expires_date": _iso(timedelta(days=30))}}),
            SubscriptionTier.METRIOS,
        )

    def test_expired_entitlement_is_free(self):
        self.assertEqual(
            _tier_from_entitlements({PRO: {"expires_date": _iso(timedelta(days=-1))}}),
            SubscriptionTier.SKETOS,
        )

    def test_null_expiry_is_a_lifetime_grant(self):
        self.assertEqual(
            _tier_from_entitlements({PRO: {"expires_date": None}}),
            SubscriptionTier.METRIOS,
        )

    def test_offset_expiry_parses(self):
        """Not every payload uses Z — an explicit offset must not read as expired."""
        expires = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        self.assertEqual(
            _tier_from_entitlements({PRO: {"expires_date": expires}}),
            SubscriptionTier.METRIOS,
        )

    def test_unreadable_expiry_fails_closed(self):
        for bad in ("not-a-date", "", 1234567890, None if False else "2026-13-45"):
            with self.subTest(bad=bad):
                self.assertEqual(
                    _tier_from_entitlements({PRO: {"expires_date": bad}}),
                    SubscriptionTier.SKETOS,
                )


class Limits(unittest.TestCase):
    def test_paid_tiers_get_more_than_free(self):
        self.assertLess(
            limit_for(SubscriptionTier.SKETOS), limit_for(SubscriptionTier.METRIOS)
        )
        self.assertEqual(
            limit_for(SubscriptionTier.GLYKOS), limit_for(SubscriptionTier.METRIOS)
        )


if __name__ == "__main__":
    unittest.main()
