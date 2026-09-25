"""
The onboarding demo: a script and deck the user "makes" before they have an
account.

Every demo is produced once, by the real pipeline (`generate_script` and
`generate_cards`, see scripts/generate_onboarding_demos.py), and stored in
app/data/onboarding_demos.json. Serving it is a file read held in memory:
nothing is generated per request, so the demo is instant, costs nothing per
user, and can't be abused as a free generation endpoint — the answer for a given
demo is the same for everyone, which is exactly why it can be computed ahead.

The briefs are picked per speaking context from onboarding (`college`, `work`,
...), so the options a user sees match the situations they said they speak in.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from functools import lru_cache
from pathlib import Path
from types import SimpleNamespace
from typing import Callable

from app.utils.enums.deck_enums import AudienceType
from app.utils.enums.user_enums import Profession, ScriptMood

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "onboarding_demos.json"

#: How many options the picker shows.
DEFAULT_LIMIT = 4

#: Deck colours, in catalogue order — the same palette real decks are drawn
#: from (services/decks/deck_colors.py), so a demo deck looks like a real one.
DEMO_DECK_COLORS = ["#F4D35E", "#FFC88A", "#F78199", "#EFC1FF", "#A0A3FF", "#ACCCC0"]


@dataclass(frozen=True)
class DemoBrief:
    """One pre-chosen demo: what would have been typed into step one of the
    wizard, and the settings steps two and three would have been set to."""

    id: str
    context: str
    label: str
    brief: str
    duration_mins: int
    card_count: int
    audience: AudienceType
    mood: ScriptMood
    profession: Profession


CATALOG: list[DemoBrief] = [
    DemoBrief(
        id="college-photosynthesis",
        context="college",
        label="Explain a science topic",
        brief=(
            "A short class presentation explaining how photosynthesis turns "
            "sunlight into food, with one everyday example that makes it stick."
        ),
        duration_mins=2,
        card_count=6,
        audience=AudienceType.STUDENTS,
        mood=ScriptMood.CONFIDENT,
        profession=Profession.STUDENT,
    ),
    DemoBrief(
        id="college-research-pitch",
        context="college",
        label="Pitch your research project",
        brief=(
            "Pitch my final-year research project on how sleep affects exam "
            "performance to my professors: the question, the method, and why it "
            "matters."
        ),
        duration_mins=3,
        card_count=8,
        # GENERAL, not FACULTY: the app's audience dial has no faculty option,
        # and the demo presets the dials to exactly what the script was made
        # with. The brief already says who is listening.
        audience=AudienceType.GENERAL,
        mood=ScriptMood.CONFIDENT,
        profession=Profession.STUDENT,
    ),
    DemoBrief(
        id="work-quarterly-update",
        context="work",
        label="Give a team update",
        brief=(
            "A quick quarterly team update: what we shipped, one number that "
            "moved, the blocker we need help with, and what's next."
        ),
        duration_mins=2,
        card_count=6,
        audience=AudienceType.BUSINESS,
        mood=ScriptMood.CONFIDENT,
        profession=Profession.BUSINESS,
    ),
    DemoBrief(
        id="work-new-idea",
        context="work",
        label="Propose a new idea",
        brief=(
            "Propose replacing our weekly status meeting with a written update: "
            "the problem, the proposal, and a two-week trial to test it."
        ),
        duration_mins=2,
        card_count=6,
        audience=AudienceType.EXECUTIVES,
        mood=ScriptMood.CALM,
        profession=Profession.BUSINESS,
    ),
    DemoBrief(
        id="presentations-product-demo",
        context="presentations",
        label="Open a product demo",
        brief=(
            "Open a product demo for an app that turns voice memos into to-do "
            "lists: hook the room, show the problem, and set up the demo."
        ),
        duration_mins=2,
        card_count=6,
        audience=AudienceType.GENERAL,
        mood=ScriptMood.ENERGETIC,
        profession=Profession.TECH,
    ),
    DemoBrief(
        id="presentations-habits-talk",
        context="presentations",
        label="Start a conference talk",
        brief=(
            "The opening of a talk on why small daily habits beat big "
            "resolutions, with a personal story as the hook."
        ),
        duration_mins=3,
        card_count=8,
        audience=AudienceType.GENERAL,
        mood=ScriptMood.REFLECTIVE,
        profession=Profession.CREATIVE,
    ),
    DemoBrief(
        id="everyday-wedding-toast",
        context="everyday",
        label="Give a wedding toast",
        brief=(
            "A warm toast at my best friend's wedding: how we met, one funny "
            "story, and a wish for the couple."
        ),
        duration_mins=2,
        card_count=6,
        audience=AudienceType.GENERAL,
        mood=ScriptMood.PLAYFUL,
        profession=Profession.OTHER,
    ),
    DemoBrief(
        id="everyday-introduce-yourself",
        context="everyday",
        label="Introduce yourself",
        brief=(
            "Introduce myself at a community meetup: who I am, what I'm into, "
            "and what I'd love to learn from the people here."
        ),
        duration_mins=1,
        card_count=5,
        audience=AudienceType.GENERAL,
        mood=ScriptMood.CALM,
        profession=Profession.OTHER,
    ),
    DemoBrief(
        id="interviews-about-yourself",
        context="interviews",
        label="Tell me about yourself",
        brief=(
            "Answer 'Tell me about yourself' in a product designer interview: "
            "my background, one project I'm proud of, and why this role."
        ),
        duration_mins=2,
        card_count=6,
        audience=AudienceType.BUSINESS,
        mood=ScriptMood.CONFIDENT,
        profession=Profession.CREATIVE,
    ),
    DemoBrief(
        id="interviews-challenge-story",
        context="interviews",
        label="A challenge you overcame",
        brief=(
            "Answer 'Tell me about a challenge you overcame' with a clear story: "
            "the situation, what I did, and the result."
        ),
        duration_mins=2,
        card_count=6,
        audience=AudienceType.BUSINESS,
        mood=ScriptMood.CALM,
        profession=Profession.TECH,
    ),
    DemoBrief(
        id="english-hometown",
        context="english",
        label="Talk about your hometown",
        brief=(
            "Describe my hometown to new friends in simple, natural English: "
            "where it is, what it's famous for, and my favourite place there."
        ),
        duration_mins=1,
        card_count=5,
        audience=AudienceType.GENERAL,
        mood=ScriptMood.PLAYFUL,
        profession=Profession.OTHER,
    ),
    DemoBrief(
        id="english-small-talk",
        context="english",
        label="Monday small talk",
        brief=(
            "Everyday small talk in English: greeting a coworker on Monday, "
            "asking about their weekend, and sharing a little about mine."
        ),
        duration_mins=1,
        card_count=5,
        audience=AudienceType.GENERAL,
        mood=ScriptMood.CALM,
        profession=Profession.OTHER,
    ),
]

CONTEXTS = tuple(dict.fromkeys(brief.context for brief in CATALOG))


@lru_cache(maxsize=1)
def load_demos() -> tuple[dict, ...]:
    """Every stored demo, in catalogue order. Read once per process."""
    with DATA_PATH.open(encoding="utf-8") as handle:
        return tuple(json.load(handle))


def _option(demo: dict) -> dict:
    """What the picker needs — everything but the script and the deck."""
    return {
        key: demo[key]
        for key in (
            "id",
            "context",
            "label",
            "brief",
            "durationMinutes",
            "cardCount",
            "audience",
            "mood",
            "profession",
        )
    }


def list_options(contexts: list[str], limit: int = DEFAULT_LIMIT) -> list[dict]:
    """
    The demos to offer, best match first.

    Demos for the contexts the user picked come first, round-robin across those
    contexts in the order given — so someone who picked "work" and "interviews"
    sees one of each before a second of either. The rest of the catalogue fills
    any remaining places, so the picker is never empty.
    """
    demos = list(load_demos())
    wanted = [c for c in dict.fromkeys(contexts) if c in CONTEXTS]

    by_context: dict[str, list[dict]] = {c: [] for c in wanted}
    for demo in demos:
        if demo["context"] in by_context:
            by_context[demo["context"]].append(demo)

    ordered: list[dict] = []
    while any(by_context.values()):
        for context in wanted:
            if by_context[context]:
                ordered.append(by_context[context].pop(0))

    chosen = {demo["id"] for demo in ordered}
    ordered.extend(demo for demo in demos if demo["id"] not in chosen)
    return [_option(demo) for demo in ordered[: max(1, limit)]]


def get_demo(demo_id: str) -> dict | None:
    return next((demo for demo in load_demos() if demo["id"] == demo_id), None)


def build_demo(
    brief: DemoBrief,
    color: str,
    generate_script: Callable[..., tuple[str, str]],
    generate_cards: Callable[[str, int], list[dict]],
    assign_colors: Callable[[list], None],
) -> dict:
    """
    Run one brief through the real pipeline and shape it for storage.

    The pipeline functions are passed in so this stays importable without an AI
    provider configured, and so the shaping can be tested on its own.
    """
    title, script = generate_script(
        description=brief.brief,
        duration_mins=brief.duration_mins,
        audience=brief.audience,
        mood=brief.mood,
        profession=brief.profession,
    )
    raw_cards = generate_cards(script, brief.card_count)

    # The colour pass works on objects with `.impact` and `.color`, exactly as
    # it does on Card rows — so demo cards are coloured by the same rule.
    cards = [SimpleNamespace(**card, color="") for card in raw_cards]
    assign_colors(cards)

    record = asdict(brief)
    return {
        "id": record["id"],
        "context": record["context"],
        "label": record["label"],
        "brief": record["brief"],
        "durationMinutes": brief.duration_mins,
        "cardCount": len(cards),
        "audience": brief.audience.value,
        "mood": brief.mood.value,
        "profession": brief.profession.value,
        "title": title,
        "script": script,
        "deck": {
            "title": title,
            "description": brief.brief,
            "color": color,
            "cards": [
                {
                    "position": position,
                    "title": card.title,
                    "description": card.description,
                    "keywords": list(card.keywords),
                    "impact": float(card.impact),
                    "delivery": card.delivery,
                    "color": card.color,
                }
                for position, card in enumerate(cards, start=1)
            ],
        },
    }
