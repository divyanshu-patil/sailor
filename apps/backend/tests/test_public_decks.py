"""The two pieces of the public-deck path that can silently be wrong.

The cursor is opaque to the client, so a bad round trip shows up as a feed that
skips or repeats decks rather than as an error. Tag normalisation is what makes
a tag a usable filter key at all — if "Interview" and "interview " survive as
different tags, the filter row fills with duplicates that each match a subset.
"""

import unittest
from datetime import datetime, timezone

from pydantic import ValidationError

from app.schemas.deck_schema import DeckPublishRequest
from app.utils.enums.deck_enums import DeckCategory
from app.utils.pagination import InvalidCursorError, decode_cursor, encode_cursor


class CursorTests(unittest.TestCase):
    def test_timestamp_cursor_round_trips(self):
        published_at = datetime(2026, 8, 16, 12, 30, 45, tzinfo=timezone.utc)
        value, row_id = decode_cursor(encode_cursor(published_at, 42))
        self.assertEqual(datetime.fromisoformat(value), published_at)
        self.assertEqual(row_id, 42)

    def test_integer_cursor_round_trips(self):
        # The "most practised" sort keys on a counter, not a timestamp.
        value, row_id = decode_cursor(encode_cursor(17, 9))
        self.assertEqual(int(value), 17)
        self.assertEqual(row_id, 9)

    def test_isoformat_contains_a_pipe_free_split(self):
        # rsplit, not split: an ISO timestamp with an offset has no pipe, but
        # splitting from the left would break the moment a sort value ever does.
        value, row_id = decode_cursor(encode_cursor("a|b", 3))
        self.assertEqual((value, row_id), ("a|b", 3))

    def test_garbage_cursor_is_rejected(self):
        with self.assertRaises(InvalidCursorError):
            decode_cursor("not-a-cursor!!")


class PublishRequestTests(unittest.TestCase):
    def _request(self, **overrides):
        payload = {
            "description": "A ten minute walkthrough of our Series A pitch.",
            "tags": ["Pitch"],
            "category": DeckCategory.SALES,
        }
        payload.update(overrides)
        return DeckPublishRequest(**payload)

    def test_tags_are_lowercased_trimmed_and_deduped(self):
        request = self._request(tags=["Interview", " interview ", "System  Design"])
        self.assertEqual(request.tags, ["interview", "system design"])

    def test_blank_only_tags_are_rejected(self):
        with self.assertRaises(ValidationError):
            self._request(tags=["   "])

    def test_description_has_a_floor(self):
        with self.assertRaises(ValidationError):
            self._request(description="short")

    def test_category_must_be_from_the_curated_list(self):
        with self.assertRaises(ValidationError):
            self._request(category="cooking")


if __name__ == "__main__":
    unittest.main()
