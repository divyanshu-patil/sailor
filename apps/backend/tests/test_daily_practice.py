"""Streak arithmetic and variation selection — the two bits of daily practice
that can be quietly wrong.

Everything else in the feature is a query or a model call. These two are pure
branchy logic sitting on a date boundary, which is where streaks always break.

The db is a stub: mark_complete/get_streak only ever commit and refresh, so
there is nothing a real session would contribute except setup.
"""

import json
import re
import secrets
import unittest

from fastapi import HTTPException
from unittest.mock import patch
from datetime import date, timedelta

from app.models.user_model import User
from app.controllers.daily_controller import (
    get_streak,
    mark_complete,
    restore_streak,
    select_variation,
)
from app.services.daily.frameworks import FRAMEWORKS, FRAMEWORKS_BY_ID
from app.tasks.daily_tasks import (
    FRAMEWORK_COOLDOWN_DAYS,
    MAX_BODY_SENTENCES,
    count_sentences,
    framework_for,
    generate_day,
    mood_for,
    situation_for,
)


class _FakeDB:
    def commit(self): pass
    def refresh(self, _obj): pass


class _FakeUser:
    def __init__(self, streak=0, longest=0, last=None, lapsed=0, last_restore=None):
        self.id = 1
        self.streak_count = streak
        self.longest_streak = longest
        self.last_practiced_on = last
        self.lapsed_streak = lapsed
        self.last_restore_on = last_restore


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


def _key(n: int) -> str:
    """A stand-in for User.public_id — 32 hex chars, as the column produces."""
    return secrets.token_hex(16) if n < 0 else f"{n:032x}"


class VariationSelection(unittest.TestCase):
    def test_is_stable_for_a_user_and_day(self):
        first = select_variation(_key(42), TODAY, 5)
        self.assertEqual(first, select_variation(_key(42), TODAY, 5))

    def test_stays_in_range(self):
        for n in range(200):
            self.assertIn(select_variation(_key(n), TODAY, 5), range(5))

    def test_spreads_across_users(self):
        # Not a distribution test — just that it isn't constant, which is the
        # failure mode a broken hash actually produces.
        picks = {select_variation(secrets.token_hex(16), TODAY, 5) for _ in range(200)}
        self.assertEqual(picks, set(range(5)))

    def test_differs_across_days(self):
        picks = {
            select_variation(_key(42), TODAY + timedelta(days=d), 5) for d in range(30)
        }
        self.assertGreater(len(picks), 1)


class PublicIdDefault(unittest.TestCase):
    """The column default is what guarantees every user gets one — both call
    sites that build a User rely on it rather than passing a value."""

    def test_column_has_a_default_producing_valid_unique_hex(self):
        default = User.__table__.c.public_id.default
        self.assertIsNotNone(default, "public_id must be defaulted on the column")

        values = {default.arg(None) for _ in range(500)}
        self.assertEqual(len(values), 500, "values must not repeat")
        for value in values:
            self.assertEqual(len(value), 32)
            int(value, 16)  # raises if it is not valid hex

    def test_is_not_sequential(self):
        # The whole reason this column exists: consecutive users must not get
        # consecutive or otherwise derivable identifiers.
        default = User.__table__.c.public_id.default
        first, second = default.arg(None), default.arg(None)
        self.assertNotEqual(int(first, 16) + 1, int(second, 16))


class FrameworkRotation(unittest.TestCase):
    def test_rotates_through_every_framework(self):
        seen = {framework_for(TODAY + timedelta(days=d)).id for d in range(len(FRAMEWORKS))}
        self.assertEqual(seen, set(FRAMEWORKS_BY_ID))

    def test_is_stable_for_a_date(self):
        self.assertEqual(framework_for(TODAY).id, framework_for(TODAY).id)

    def test_never_repeats_inside_the_cooldown(self):
        # The guarantee the spec asks for, checked directly rather than trusted
        # to the cycle-length assertion in daily_tasks.
        window = FRAMEWORK_COOLDOWN_DAYS
        days = [framework_for(TODAY + timedelta(days=d)).id for d in range(365)]
        for start in range(len(days) - window):
            span = days[start : start + window + 1]
            self.assertEqual(
                len(span), len(set(span)), f"framework repeats within {window} days at day {start}"
            )

    def test_usage_is_even_over_a_year(self):
        counts: dict[str, int] = {}
        for d in range(len(FRAMEWORKS) * 10):
            fid = framework_for(TODAY + timedelta(days=d)).id
            counts[fid] = counts.get(fid, 0) + 1
        self.assertEqual(set(counts.values()), {10})

    def test_situation_comes_from_the_frameworks_own_best_for(self):
        # A framework applied to a situation it was never meant for is the
        # failure this pairing exists to prevent.
        for d in range(len(FRAMEWORKS) * 4):
            day = TODAY + timedelta(days=d)
            framework = framework_for(day)
            self.assertIn(situation_for(day, framework), framework.best_for)

    def test_situation_cycles_across_a_frameworks_appearances(self):
        framework = next(f for f in FRAMEWORKS if len(f.best_for) > 1)
        first_day = next(
            TODAY + timedelta(days=d)
            for d in range(len(FRAMEWORKS))
            if framework_for(TODAY + timedelta(days=d)).id == framework.id
        )
        seen = {
            situation_for(first_day + timedelta(days=len(FRAMEWORKS) * i), framework)
            for i in range(len(framework.best_for))
        }
        self.assertEqual(seen, set(framework.best_for))

    def test_mood_is_stable_for_a_date(self):
        # Regenerating a day must not silently change its tone.
        self.assertEqual(mood_for(TODAY), mood_for(TODAY))


class FrameworkLibrary(unittest.TestCase):
    def test_every_framework_is_complete(self):
        for f in FRAMEWORKS:
            self.assertTrue(f.steps, f.id)
            self.assertTrue(f.short_name.strip(), f.id)
            self.assertTrue(f.best_for, f.id)
            self.assertTrue(f.example_body.strip(), f.id)
            self.assertTrue(f.example_tip.strip(), f.id)

    def test_ids_are_unique(self):
        self.assertEqual(len(FRAMEWORKS_BY_ID), len(FRAMEWORKS))

    def test_short_labels_fit_a_widget_badge(self):
        # The widget renders this at ~20 characters wide; anything longer
        # truncates mid-word on a systemSmall tile.
        for f in FRAMEWORKS:
            self.assertLessEqual(len(f.short_name), 22, f"{f.id} short_name is too long")

    def test_short_labels_are_unique(self):
        shorts = [f.short_name for f in FRAMEWORKS]
        self.assertEqual(len(set(shorts)), len(shorts))

    def test_worked_examples_stay_within_the_snippet_shape(self):
        # The examples are the prompt's only few-shot. One that runs long
        # teaches the model to run long.
        for f in FRAMEWORKS:
            sentences = [s for s in re.split(r"(?<=[.!?])\s+", f.example_body.strip()) if s]
            self.assertLessEqual(len(sentences), 4, f"{f.id} example body is too long")
            self.assertLessEqual(len(f.example_tip.split()), 32, f"{f.id} tip is too long")


class BodyLength(unittest.TestCase):
    """The 2-3 sentence cap, which the first real generation run broke.

    Every PREP variation came back as four sentences — one each for Point,
    Reason, Example, Point. The prompt now says steps share sentences, and this
    is the backstop for when the model ignores it anyway.
    """

    def test_counts_sentences_across_terminators(self):
        self.assertEqual(count_sentences("One. Two! Three?"), 3)
        self.assertEqual(count_sentences("  Only one  "), 1)
        self.assertEqual(count_sentences(""), 0)

    def _generate_with(self, payload):
        with patch("app.tasks.daily_tasks.chat", return_value=json.dumps(payload)):
            return generate_day(TODAY)

    def test_over_long_variations_are_dropped(self):
        good = {"body": "One. Two. Three.", "tip": "t"}
        bad = {"body": "One. Two. Three. Four. Five.", "tip": "t"}
        units = self._generate_with([good, bad, good])

        self.assertEqual(len(units), 2, "the four-sentence body should not survive")
        for unit in units:
            self.assertLessEqual(count_sentences(unit["body"]), MAX_BODY_SENTENCES)

    def test_variation_index_stays_contiguous_after_a_drop(self):
        # The hash picks by position, so a gap would make some users resolve to
        # a variation that does not exist.
        good = {"body": "One. Two.", "tip": "t"}
        bad = {"body": "A. B. C. D.", "tip": "t"}
        units = self._generate_with([bad, good, bad, good, good])
        self.assertEqual([u["variation_index"] for u in units], [0, 1, 2])

    def test_a_day_is_never_left_empty(self):
        # If every variation runs long, shipping slightly wordy content beats
        # serving a 503 over a style rule.
        bad = {"body": "A. B. C. D. E.", "tip": "t"}
        worse = {"body": "A. B. C. D. E. F. G.", "tip": "t"}
        units = self._generate_with([worse, bad, worse])

        self.assertTrue(units, "a day must not be emptied by the length rule")
        # And it keeps the shortest ones available.
        self.assertEqual(count_sentences(units[0]["body"]), 5)

    def test_empty_bodies_are_still_dropped(self):
        units = self._generate_with(
            [{"body": "", "tip": "t"}, {"body": "Fine. Good.", "tip": ""}, {"body": "Ok. Yes.", "tip": "t"}]
        )
        self.assertEqual(len(units), 1)


if __name__ == "__main__":
    unittest.main()

class RestoreStreak(unittest.TestCase):
    """The cap and the arithmetic. Both are one-line conditions that are wrong
    in opposite directions if the date maths slips."""

    def _lapsed_user(self, streak=12, **kw):
        """A user whose streak broke: last practised two days ago, so the first
        `get_streak` inside restore is what banks `lapsed_streak`."""
        return _FakeUser(streak=streak, longest=streak,
                         last=TODAY - timedelta(days=2), **kw)

    def test_restores_the_streak_that_lapsed(self):
        user = self._lapsed_user()
        result = restore_streak(DB, user, TODAY)
        self.assertEqual(result.currentStreak, 12)
        # Yesterday: restored, but today still has to be practised.
        self.assertEqual(user.last_practiced_on, TODAY - timedelta(days=1))
        self.assertFalse(result.completedToday)
        # Spent.
        self.assertEqual(result.restorableStreak, 0)
        self.assertFalse(result.canRestore)
        self.assertTrue(result.restoreUsedThisMonth)

    def test_restored_streak_then_extends_today(self):
        user = self._lapsed_user()
        restore_streak(DB, user, TODAY)
        self.assertEqual(mark_complete(DB, user, TODAY).currentStreak, 13)

    def test_second_restore_in_same_month_is_refused(self):
        user = self._lapsed_user()
        restore_streak(DB, user, TODAY)
        user.lapsed_streak = 5  # lapsed again inside the same month
        with self.assertRaises(HTTPException) as caught:
            restore_streak(DB, user, TODAY + timedelta(days=3))
        self.assertEqual(caught.exception.status_code, 409)

    def test_next_calendar_month_allows_another(self):
        # 30th, then the 1st: 14 days apart, but a different month, so the cap
        # must not treat it as "within a month".
        user = self._lapsed_user(last_restore=date(2026, 9, 30))
        result = restore_streak(DB, user, date(2026, 10, 1))
        self.assertEqual(result.currentStreak, 12)

    def test_nothing_to_restore_is_refused(self):
        user = _FakeUser(streak=6, longest=6, last=TODAY)  # alive, never lapsed
        with self.assertRaises(HTTPException) as caught:
            restore_streak(DB, user, TODAY)
        self.assertEqual(caught.exception.status_code, 400)

    def test_reading_the_streak_twice_does_not_erase_what_is_restorable(self):
        user = self._lapsed_user()
        get_streak(DB, user, TODAY)   # banks 12, zeroes the live count
        get_streak(DB, user, TODAY)   # must not bank 0 over it
        self.assertEqual(restore_streak(DB, user, TODAY).currentStreak, 12)
