"""The two pieces of the single-call script path that aren't the model.

The retention guard is the one standing in for a guarantee the old pipeline had
structurally: it re-sent only the beats an instruction touched, so untouched
text came back byte-for-byte. One whole-script call can't promise that, and the
failure mode it's guarding against — a "revision" that quietly returns half the
script — is invisible until the presenter is on stage with a talk that lost two
minutes.
"""

import unittest
from unittest.mock import patch

from app.services.ai import script_generator
from app.services.ai.script_generator import (
    MIN_REVISION_RETENTION,
    ScriptGenerationError,
    _split_title,
    revise_script,
)
from app.utils.enums.deck_enums import AudienceType

ORIGINAL = " ".join(f"word{i}" for i in range(200))


def _revise(returned: str):
    with patch.object(script_generator, "_call_model", return_value=returned):
        return revise_script(
            script=ORIGINAL,
            instruction="make the opening punchier",
            title="A Title",
            audience=AudienceType.TECHNICAL,
        )


class RetentionGuardTests(unittest.TestCase):
    def test_a_gutted_revision_is_refused(self):
        gutted = " ".join(f"word{i}" for i in range(50))  # 25% of the original
        with self.assertRaises(ScriptGenerationError) as caught:
            _revise(gutted)
        # The message reaches the user through the task's error field, so it has
        # to say their script survived.
        self.assertIn("unchanged", str(caught.exception))

    def test_a_revision_that_keeps_its_length_is_returned(self):
        kept = " ".join(f"word{i}" for i in range(190))
        self.assertEqual(_revise(kept).split()[:3], ["word0", "word1", "word2"])

    def test_the_threshold_is_where_it_claims_to_be(self):
        just_under = " ".join(["w"] * int(200 * MIN_REVISION_RETENTION - 1))
        just_over = " ".join(["w"] * int(200 * MIN_REVISION_RETENTION + 1))
        with self.assertRaises(ScriptGenerationError):
            _revise(just_under)
        self.assertTrue(_revise(just_over))

    def test_a_longer_revision_is_fine(self):
        # Adding an example is the most common instruction there is.
        longer = " ".join(["w"] * 260)
        self.assertEqual(len(_revise(longer).split()), 260)


class TitleSplitTests(unittest.TestCase):
    def test_title_line_is_pulled_off_the_script(self):
        title, script = _split_title("TITLE: The Latency Leak\n\n## [HOOK] · ~30s\nBody.", "brief")
        self.assertEqual(title, "The Latency Leak")
        self.assertTrue(script.startswith("## [HOOK]"))
        self.assertNotIn("TITLE:", script)

    def test_a_missing_title_falls_back_to_the_brief(self):
        title, script = _split_title(
            "## [HOOK] · ~30s\nBody.", "A talk about connection pool exhaustion"
        )
        self.assertTrue(title)
        self.assertNotIn("TITLE", title)
        self.assertTrue(script.startswith("## [HOOK]"))

    def test_an_overlong_title_is_shortened_to_its_subject(self):
        title, _ = _split_title("TITLE: The Future of Renewable Energy Storage Systems", "b")
        self.assertLessEqual(len(title.split()), 4)
        # Trimming must not leave a dangling connective.
        self.assertNotIn(title.split()[-1].lower(), {"of", "the", "and", "to"})


if __name__ == "__main__":
    unittest.main()
