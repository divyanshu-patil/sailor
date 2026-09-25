import difflib
import re
from typing import List

from pydantic import BaseModel, Field, field_validator

from app.utils.enums.speaking_style import SpeakingStyle

HEX_COLOR_RE = re.compile(r"^#(?:[0-9a-fA-F]{3}){1,2}$")

# Common synonyms models reach for despite instructions. Map them to the
# closest real enum value instead of failing the whole deck over one word.
_DELIVERY_SYNONYMS = {
    "listing": "step_by_step",
    "informative": "educational",
    "informational": "educational",
    "instructive": "educational",
    "explanatory": "explaining",
    "detailed": "analytical",
    "narrative": "storytelling",
    "engaging": "interactive",
    "inviting": "friendly",
    "warm": "friendly",
    "authoritative": "confident",
    "concise": "summary",
    "opening": "introduction",
    "closing": "conclusion",
    "wrap_up": "conclusion",
    "wrapup": "conclusion",
    "highlight": "emphasis",
    "emphatic": "emphasis",
    "inspiring": "inspirational",
    "motivating": "motivational",
    "convincing": "persuasive",
    "funny": "humorous",
    "relaxed": "calm",
    "intense": "serious",
    "exciting": "excited",
    "thoughtful": "reflective",
    "provocative": "thought_provoking",
    "question": "questioning",
    "enthusiastic": "energetic",
}

_VALID_DELIVERY_VALUES = {s.value for s in SpeakingStyle}


def normalize_delivery(raw: str) -> str:
    """Best-effort mapping of an arbitrary AI string onto SpeakingStyle.

    Public because the card generator needs it too: the model reaches for words
    outside the enum often enough ('explanatory', 'sad' both seen in production)
    that treating an unknown value as fatal cost a whole batch each time. Same
    normalisation in both places means one list of synonyms to maintain.
    """
    key = re.sub(r"[\s\-]+", "_", raw.strip().lower())

    if key in _VALID_DELIVERY_VALUES:
        return key
    if key in _DELIVERY_SYNONYMS:
        return _DELIVERY_SYNONYMS[key]

    # last resort: fuzzy match against known values (catches typos/plurals)
    close = difflib.get_close_matches(key, _VALID_DELIVERY_VALUES, n=1, cutoff=0.7)
    if close:
        return close[0]

    # safe, neutral fallback — never let one field kill the whole card
    return SpeakingStyle.EXPLAINING.value


class AICardOutput(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)
    description: str = Field(..., min_length=1, max_length=500)
    color: str
    impact: float = Field(..., ge=0.0, le=1.0)
    delivery: SpeakingStyle

    @field_validator("delivery", mode="before")
    @classmethod
    def _coerce_delivery(cls, v):
        if isinstance(v, str) and v not in _VALID_DELIVERY_VALUES:
            return normalize_delivery(v)
        return v

    @field_validator("color")
    @classmethod
    def validate_hex_color(cls, v: str) -> str:
        if not HEX_COLOR_RE.match(v):
            raise ValueError(f"'{v}' is not a valid hex color")
        return v.upper()


class AIDeckScriptOutput(BaseModel):
    title: str = Field(..., min_length=1, max_length=150)
    script: str = Field(..., min_length=1)
    color: str

    @field_validator("color")
    @classmethod
    def validate_hex_color(cls, v: str) -> str:
        if not HEX_COLOR_RE.match(v):
            raise ValueError(f"'{v}' is not a valid hex color")
        return v.upper()


class AICardBatchOutput(BaseModel):
    cards: List[AICardOutput]


class AIGeneratedPresentationCardOutput(BaseModel):
    cardNumber: int = Field(..., ge=1)
    title: str = Field(..., min_length=1, max_length=120)
    speakerNotes: str = Field(..., min_length=1)
    slideContent: List[str] = Field(..., min_length=1)
    estimatedWordCount: int = Field(..., ge=1)
    estimatedDurationSeconds: int = Field(..., ge=1)
    impact: float = Field(..., ge=0.0, le=1.0)
    delivery: SpeakingStyle
    color: str

    @field_validator("delivery", mode="before")
    @classmethod
    def _coerce_delivery(cls, v):
        if isinstance(v, str) and v not in _VALID_DELIVERY_VALUES:
            return normalize_delivery(v)
        return v

    @field_validator("color")
    @classmethod
    def validate_hex_color(cls, v: str) -> str:
        if not HEX_COLOR_RE.match(v):
            raise ValueError(f"'{v}' is not a valid hex color")
        return v.upper()


class AIGeneratedPresentationOutput(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=150)
    color: str | None = None
    cards: List[AIGeneratedPresentationCardOutput]

    @field_validator("color")
    @classmethod
    def validate_hex_color(cls, v: str) -> str:
        if v is None:
            return v
        if not HEX_COLOR_RE.match(v):
            raise ValueError(f"'{v}' is not a valid hex color")
        return v.upper()


class AIDeckOutput(BaseModel):
    title: str = Field(..., min_length=1, max_length=150)
    script: str = Field(..., min_length=1)
    color: str
    cards: List[AICardOutput]

    @field_validator("color")
    @classmethod
    def validate_hex_color(cls, v: str) -> str:
        if not HEX_COLOR_RE.match(v):
            raise ValueError(f"'{v}' is not a valid hex color")
        return v.upper()
