"""Streak arithmetic and variation selection — the two bits of daily practice
that can be quietly wrong.

Everything else in the feature is a query or a model call. These two are pure
branchy logic sitting on a date boundary, which is where streaks always break.

The db is a stub: mark_complete/get_streak only ever commit and refresh, so
there is nothing a real session would contribute except setup.
"""

import unittest
from datetime import date, timedelta

from app.controllers.daily_controller import get_streak, mark_complete, select_variation
from app.models.daily_model import DailyContentType
from app.tasks.daily_tasks import type_for


class _FakeDB:
    def commit(self): pass
    def refresh(self, _obj): pass


class _FakeUser:
    def __init__(self, streak=0, longest=0, last=None):
        self.id = 1
        self.streak_count = streak
        self.longest_streak = longest
        self.last_practiced_on = last


TODAY = date(2026, 9, 17)
DB = _FakeDB()


class MarkComplete(unittest.TestCase):
    def test_first_ever_completion_starts_at_one(self):
        user = _FakeUser()
        result = mark_complete(DB, user, TODAY)
        self.assertEqual(result.currentStreak, 1)
        self.assertEqual(result.longestStreak, 1)
        self.assertEqual(result.lastCompletedDate, TODAY)
        self.assertTrue(result.completedToday)

    def test_consecutive_day_increments(self):
        user = _FakeUser(streak=4, longest=4, last=TODAY - timedelta(days=1))
        self.assertEqual(mark_complete(DB, user, TODAY).currentStreak, 5)

    def test_missed_day_restarts_at_one(self):
        user = _FakeUser(streak=9, longest=9, last=TODAY - timedelta(days=2))
        result = mark_complete(DB, user, TODAY)
        self.assertEqual(result.currentStreak, 1)
        # The record survives the lapse.
        self.assertEqual(result.longestStreak, 9)

    def test_second_tap_same_day_is_a_noop(self):
        user = _FakeUser(streak=3, longest=3, last=TODAY)
        self.assertEqual(mark_complete(DB, user, TODAY).currentStreak, 3)
        self.assertEqual(mark_complete(DB, user, TODAY).currentStreak, 3)

    def test_clock_moving_backwards_does_not_rewind_the_streak(self):
        user = _FakeUser(streak=3, longest=3, last=TODAY)
        result = mark_complete(DB, user, TODAY - timedelta(days=1))
        self.assertEqual(result.currentStreak, 3)
        self.assertEqual(result.lastCompletedDate, TODAY)


class GetStreak(unittest.TestCase):
    def test_practised_yesterday_is_still_alive(self):
        user = _FakeUser(streak=6, longest=6, last=TODAY - timedelta(days=1))
        result = get_streak(DB, user, TODAY)
        self.assertEqual(result.currentStreak, 6)
        self.assertFalse(result.completedToday)

    def test_full_day_missed_resets_on_read(self):
        user = _FakeUser(streak=6, longest=6, last=TODAY - timedelta(days=2))
        result = get_streak(DB, user, TODAY)
        self.assertEqual(result.currentStreak, 0)
        self.assertEqual(result.longestStreak, 6)

    def test_practised_today_reads_as_completed(self):
        user = _FakeUser(streak=6, longest=6, last=TODAY)
        self.assertTrue(get_streak(DB, user, TODAY).completedToday)


class VariationSelection(unittest.TestCase):
    def test_is_stable_for_a_user_and_day(self):
        first = select_variation(42, TODAY, 5)
        self.assertEqual(first, select_variation(42, TODAY, 5))

    def test_stays_in_range(self):
        for user_id in range(200):
            self.assertIn(select_variation(user_id, TODAY, 5), range(5))

    def test_spreads_across_users(self):
        # Not a distribution test — just that it isn't constant, which is the
        # failure mode a broken hash actually produces.
        picks = {select_variation(user_id, TODAY, 5) for user_id in range(200)}
        self.assertEqual(picks, set(range(5)))

    def test_differs_across_days(self):
        picks = {select_variation(42, TODAY + timedelta(days=d), 5) for d in range(30)}
        self.assertGreater(len(picks), 1)


class DailyType(unittest.TestCase):
    def test_rotates_through_every_type(self):
        seen = {type_for(TODAY + timedelta(days=d)) for d in range(len(DailyContentType))}
        self.assertEqual(seen, set(DailyContentType))

    def test_is_stable_for_a_date(self):
        self.assertEqual(type_for(TODAY), type_for(TODAY))


if __name__ == "__main__":
    unittest.main()
