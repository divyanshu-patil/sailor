"""How a script sounds: mood, profession, experience level.

Two directions, both here because they are the same three fields:

  - `resolve_voice` fills a submitted brief's blanks from the user's settings.
    The wizard normally sends all three (it shows them pre-selected), so this is
    what covers an older client, a scripted request, or a user who never set a
    profile.
  - `voice_of` reads them back off a stored generation for the worker. The
    columns are plain strings, and a value that no longer maps to an enum member
    degrades to None — an unrecognised mood should cost the script its tone, not
    its generation.
"""

from sqlalchemy.orm import Session

from app.models.preferences_model import UserPreferences
from app.models.script_model import ScriptGeneration
from app.models.user_model import User
from app.schemas.script_schema import ScriptGenerateRequest
from app.utils.enums.user_enums import ExperienceLevel, Profession, ScriptMood

Voice = tuple[ScriptMood | None, Profession | None, ExperienceLevel | None]


def _coerce(enum_cls, value):
    if value is None:
        return None
    try:
        return enum_cls(value)
    except ValueError:
        return None


def resolve_voice(payload: ScriptGenerateRequest, user: User, db: Session) -> Voice:
    """The brief's own choices, falling back to what settings say."""
    mood = payload.mood
    if mood is None:
        prefs = (
            db.query(UserPreferences).filter(UserPreferences.user_id == user.id).one_or_none()
        )
        mood = _coerce(ScriptMood, prefs.default_mood if prefs else None)

    profession = payload.profession or _coerce(Profession, user.profession)
    experience = payload.experience_level or _coerce(ExperienceLevel, user.experience_level)
    return mood, profession, experience


def voice_of(generation: ScriptGeneration) -> Voice:
    """What was stored on the generation when the brief was submitted."""
    return (
        _coerce(ScriptMood, generation.mood),
        _coerce(Profession, generation.profession),
        _coerce(ExperienceLevel, generation.experience_level),
    )
