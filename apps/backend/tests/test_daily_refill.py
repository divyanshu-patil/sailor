"""The refill task's destructive path.

`force=True` replaces existing content, which makes it the one part of daily
practice that can lose data. It is covered here against a real (SQLite) database
rather than mocks, because the thing being tested is transaction ordering — and
a mocked session will happily "commit" an ordering that would corrupt a real one.
"""

import unittest
from datetime import date, timedelta
from unittest.mock import patch

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.models.daily_model import DailyContent
from app.services.ai.chat import ModelCallError
from app.tasks import daily_tasks


def _payload(marker: str) -> str:
    """Five valid variations, tagged so a regenerated day is distinguishable."""
    items = ", ".join(
        f'{{"body": "{marker} body {i}. Second sentence.", "tip": "{marker} tip {i}"}}'
        for i in range(5)
    )
    return f"[{items}]"


class ForceRegeneration(unittest.TestCase):
    def setUp(self):
        # StaticPool would be needed for threads; map_parallel runs a single
        # item inline, and these tests generate one day at a time.
        self.engine = create_engine("sqlite://")
        Base.metadata.create_all(self.engine, tables=[DailyContent.__table__])
        self.Session = sessionmaker(bind=self.engine)

        patcher = patch.object(daily_tasks, "SessionLocal", self.Session)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.addCleanup(self.engine.dispose)

        # Keep every run to a single day so `date.today()` anchors the range.
        self.today = date.today()

    def _rows(self):
        with self.Session() as s:
            return s.execute(
                select(DailyContent.date, DailyContent.body).order_by(
                    DailyContent.date, DailyContent.variation_index
                )
            ).all()

    def _run(self, marker: str, days: int = 1, **kwargs) -> int:
        with patch.object(daily_tasks, "chat", return_value=_payload(marker)):
            return daily_tasks.refill_daily_content(days=days, **kwargs)

    def test_fills_an_empty_buffer(self):
        self.assertEqual(self._run("first"), 1)
        rows = self._rows()
        self.assertEqual(len(rows), 5)
        self.assertTrue(all(r.date == self.today for r in rows))

    def test_without_force_an_existing_day_is_left_alone(self):
        self._run("first")
        self.assertEqual(self._run("second"), 0, "a filled day should not be regenerated")
        self.assertTrue(all("first" in r.body for r in self._rows()))

    def test_force_alone_does_not_replace_today(self):
        """Today is protected from a plain force regeneration.

        Rewriting the day someone is already practising swaps the snippet out
        mid-session: their line count changes and the completion screen's
        numbers stop matching what they actually read.
        """
        self._run("first")
        self.assertEqual(self._run("second", force=True), 0)
        self.assertTrue(all("first" in r.body for r in self._rows()))

    def test_force_with_override_today_replaces_today(self):
        self._run("first")
        self.assertEqual(self._run("second", force=True, override_today=True), 1)

        rows = self._rows()
        self.assertEqual(len(rows), 5, "the old rows must be gone, not appended to")
        self.assertTrue(all("second" in r.body for r in rows))

    def test_force_still_fills_today_when_it_is_empty(self):
        # The protection is against *replacing* content, not against filling a
        # hole — an empty today must still be generated.
        self.assertEqual(self._run("first", force=True), 1)
        self.assertEqual(len(self._rows()), 5)

    def test_force_replaces_future_days_without_override(self):
        self._run("first", days=3)
        self.assertEqual(self._run("second", days=3, force=True), 2, "today held back, two replaced")

        rows = self._rows()
        today_rows = [r for r in rows if r.date == self.today]
        later_rows = [r for r in rows if r.date != self.today]
        self.assertTrue(all("first" in r.body for r in today_rows), "today untouched")
        self.assertTrue(all("second" in r.body for r in later_rows), "later days replaced")

    def test_force_keeps_existing_content_when_generation_fails(self):
        """The regression this ordering exists for.

        The task used to delete the whole range up front and generate after, so
        an outage during a force regeneration emptied the buffer permanently and
        every user got a 503 until the next beat.
        """
        self._run("first")
        before = self._rows()

        with patch.object(daily_tasks, "chat", side_effect=ModelCallError("outage")):
            filled = daily_tasks.refill_daily_content(days=1, force=True, override_today=True)

        self.assertEqual(filled, 0)
        self.assertEqual(self._rows(), before, "force must never destroy content it cannot replace")

    def test_force_keeps_existing_content_when_the_model_returns_junk(self):
        self._run("first")
        before = self._rows()

        with patch.object(daily_tasks, "chat", return_value="not json at all"):
            self.assertEqual(
                daily_tasks.refill_daily_content(days=1, force=True, override_today=True), 0
            )

        self.assertEqual(self._rows(), before)

    def test_force_keeps_existing_content_when_every_variation_is_empty(self):
        self._run("first")
        before = self._rows()

        with patch.object(daily_tasks, "chat", return_value='[{"body": "", "tip": ""}]'):
            self.assertEqual(
                daily_tasks.refill_daily_content(days=1, force=True, override_today=True), 0
            )

        self.assertEqual(self._rows(), before)


class BufferWindow(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        Base.metadata.create_all(self.engine, tables=[DailyContent.__table__])
        self.Session = sessionmaker(bind=self.engine)
        patcher = patch.object(daily_tasks, "SessionLocal", self.Session)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.addCleanup(self.engine.dispose)

    def test_fills_exactly_the_requested_number_of_days_from_today(self):
        with patch.object(daily_tasks, "chat", return_value=_payload("x")):
            filled = daily_tasks.refill_daily_content(days=daily_tasks.BUFFER_DAYS)

        self.assertEqual(filled, daily_tasks.BUFFER_DAYS)
        with self.Session() as s:
            days = sorted(set(s.execute(select(DailyContent.date)).scalars().all()))
        self.assertEqual(days[0], date.today(), "the buffer must start at today, not tomorrow")
        self.assertEqual(
            days[-1], date.today() + timedelta(days=daily_tasks.BUFFER_DAYS - 1)
        )
        self.assertEqual(len(days), daily_tasks.BUFFER_DAYS)


if __name__ == "__main__":
    unittest.main()
