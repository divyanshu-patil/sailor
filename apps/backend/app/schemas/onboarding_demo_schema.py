"""Shapes for the onboarding demo endpoints. camelCase on the wire, like the
rest of what the app reads, because the stored demos are already written that
way — see services/onboarding_demos.py."""

from pydantic import BaseModel

from app.utils.enums.deck_enums import AudienceType
from app.utils.enums.user_enums import Profession, ScriptMood


class DemoOption(BaseModel):
    """One choice in the picker: the brief and the settings it was made with."""

    id: str
    context: str
    label: str
    brief: str
    durationMinutes: int
    cardCount: int
    audience: AudienceType
    mood: ScriptMood
    profession: Profession


class DemoCard(BaseModel):
    position: int
    title: str
    description: str
    keywords: list[str]
    impact: float
    delivery: str
    color: str


class DemoDeck(BaseModel):
    title: str
    description: str
    color: str
    cards: list[DemoCard]


class DemoDetail(DemoOption):
    """The finished demo: what the pipeline produced for this brief."""

    title: str
    script: str
    deck: DemoDeck
