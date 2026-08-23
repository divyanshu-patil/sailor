"""The voice path has two branches worth pinning: what wins when the brief and
the user's settings disagree, and whether a changed voice is a different brief."""

import unittest
from types import SimpleNamespace

from app.schemas.script_schema import ScriptGenerateRequest
from app.services.ai.prompts import speaker_profile_block
from app.services.scripts.fingerprint import brief_fingerprint
from app.services.scripts.voice import resolve_voice, voice_of
from app.utils.enums.deck_enums import AudienceType
from app.utils.enums.user_enums import ExperienceLevel, Profession, ScriptMood


class _FakeQuery:
    def __init__(self, result):
        self._result = result

    def filter(self, *_):
        return self

    def one_or_none(self):
        return self._result


class _FakeDb:
    def __init__(self, prefs=None):
        self._prefs = prefs

    def query(self, *_):
        return _FakeQuery(self._prefs)


def _brief(**overrides) -> ScriptGenerateRequest:
    return ScriptGenerateRequest(
        description="a talk about forecasting discipline",
        cardCount=8,
        durationMinutes=10,
        audience=AudienceType.GENERAL,
        **overrides,
    )


USER = SimpleNamespace(id=1, profession="tech", experience_level="pro")


class ResolveVoiceTests(unittest.TestCase):
    def test_brief_overrides_settings(self):
        payload = _brief(
            mood="playful", profession="legal", experienceLevel="beginner"
        )
        db = _FakeDb(SimpleNamespace(default_mood="confident"))
        self.assertEqual(
            resolve_voice(payload, USER, db),
            (ScriptMood.PLAYFUL, Profession.LEGAL, ExperienceLevel.BEGINNER),
        )

    def test_falls_back_to_settings_when_brief_is_silent(self):
        db = _FakeDb(SimpleNamespace(default_mood="calm"))
        self.assertEqual(
            resolve_voice(_brief(), USER, db),
            (ScriptMood.CALM, Profession.TECH, ExperienceLevel.PRO),
        )

    def test_no_preferences_row_and_empty_profile_is_no_voice(self):
        blank = SimpleNamespace(id=2, profession=None, experience_level=None)
        self.assertEqual(resolve_voice(_brief(), blank, _FakeDb()), (None, None, None))

    def test_unknown_stored_value_degrades_instead_of_raising(self):
        generation = SimpleNamespace(
            mood="grumpy", profession="tech", experience_level=None
        )
        self.assertEqual(voice_of(generation), (None, Profession.TECH, None))


class VoiceInPromptTests(unittest.TestCase):
    def test_changing_mood_changes_the_fingerprint(self):
        common = dict(
            description="a talk about forecasting discipline",
            duration_mins=10,
            card_count=8,
            audience=AudienceType.GENERAL,
        )
        self.assertNotEqual(
            brief_fingerprint(**common, mood=ScriptMood.CALM),
            brief_fingerprint(**common, mood=ScriptMood.PLAYFUL),
        )

    def test_no_voice_renders_no_block(self):
        self.assertEqual(speaker_profile_block(), "")

    def test_voice_reaches_the_prompt(self):
        block = speaker_profile_block(
            ScriptMood.ENERGETIC, Profession.HEALTHCARE, ExperienceLevel.BEGINNER
        )
        self.assertIn("High tempo", block)
        self.assertIn("clinical", block)
        self.assertIn("New to speaking", block)


if __name__ == "__main__":
    unittest.main()
