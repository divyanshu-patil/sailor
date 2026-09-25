"""The nickname rules, which are what keep two accounts from sharing a name.

Normalization is the part that can be wrong silently: if "Alex" and " alex "
normalize differently they both survive the unique index and the app shows two
people as the same nickname. Validation only has to be permissive enough not to
reject a real name.

Run: uv run python -m unittest tests.test_nickname
"""

import unittest

from app.utils.nickname import (
    InvalidNickname,
    normalize_nickname,
    validate_nickname,
)


class NormalizeTests(unittest.TestCase):
    def test_case_is_folded(self):
        self.assertEqual(normalize_nickname("ALEX"), "alex")

    def test_whitespace_is_collapsed_and_trimmed(self):
        self.assertEqual(normalize_nickname("  Alex   More  "), "alex more")

    def test_case_variants_share_one_identity(self):
        variants = ["Alex", "alex", "ALEX", " Alex "]
        self.assertEqual(len({normalize_nickname(v) for v in variants}), 1)

    def test_casefold_is_stronger_than_lower(self):
        self.assertEqual(normalize_nickname("Straße"), "strasse")


class ValidateTests(unittest.TestCase):
    def test_returns_the_display_form(self):
        self.assertEqual(validate_nickname("  Alex  "), "Alex")

    def test_spaces_are_rejected(self):
        for raw in ("Al ex", "A\tB"):
            with self.assertRaises(InvalidNickname) as ctx:
                validate_nickname(raw)
            self.assertEqual(ctx.exception.code, "invalid_chars")

    def test_empty_is_rejected(self):
        for raw in (None, "", "   "):
            with self.assertRaises(InvalidNickname) as ctx:
                validate_nickname(raw)
            self.assertEqual(ctx.exception.code, "empty")

    def test_too_short_is_rejected(self):
        with self.assertRaises(InvalidNickname) as ctx:
            validate_nickname("a")
        self.assertEqual(ctx.exception.code, "too_short")

    def test_too_long_is_rejected(self):
        with self.assertRaises(InvalidNickname) as ctx:
            validate_nickname("a" * 8)
        self.assertEqual(ctx.exception.code, "too_long")

    def test_invalid_characters_are_rejected(self):
        # Seven characters or fewer, so the length check doesn't answer first.
        for raw in ("<b>", "a@b", "emo😀", "sl/ash"):
            with self.assertRaises(InvalidNickname) as ctx:
                validate_nickname(raw)
            self.assertIn(ctx.exception.code, ("invalid_chars", "control_chars"))

    def test_punctuation_only_is_rejected(self):
        for raw in ("...", "___", "---"):
            with self.assertRaises(InvalidNickname) as ctx:
                validate_nickname(raw)
            self.assertEqual(ctx.exception.code, "invalid_chars")

    def test_unicode_and_separators_are_accepted(self):
        self.assertEqual(validate_nickname("José"), "José")
        self.assertEqual(validate_nickname("小明"), "小明")
        self.assertEqual(validate_nickname("Jo-Ann"), "Jo-Ann")
        self.assertEqual(validate_nickname("O'Neill"), "O'Neill")
        self.assertEqual(validate_nickname("Ana_Mia"), "Ana_Mia")


if __name__ == "__main__":
    unittest.main()
