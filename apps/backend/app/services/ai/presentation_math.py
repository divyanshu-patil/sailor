from __future__ import annotations

import math
import re
from typing import Sequence


WORDS_PER_MINUTE_BY_AUDIENCE = (
    135,
    115,
    145,
    130,
    155,
    120,
)

WORD_COUNT_SHORTFALL_THRESHOLD = 0.9


def getWordsPerMinute(audience_index: int) -> int:
    if 0 <= audience_index < len(WORDS_PER_MINUTE_BY_AUDIENCE):
        return WORDS_PER_MINUTE_BY_AUDIENCE[audience_index]
    return WORDS_PER_MINUTE_BY_AUDIENCE[0]


def calculateTargetWords(duration_minutes: int, audience_index: int) -> int:
    return duration_minutes * getWordsPerMinute(audience_index)


def calculateWordsPerCard(target_words: int, card_count: int) -> int:
    return math.ceil(target_words / card_count)


def countWords(text: str) -> int:
    return len(re.findall(r"\b\w+\b", text))


def buildScriptFromCards(cards: Sequence[object]) -> str:
    notes: list[str] = []

    for card in cards:
        if isinstance(card, dict):
            speaker_notes = card.get("speakerNotes", "")
        else:
            speaker_notes = getattr(card, "speakerNotes", "")

        if speaker_notes:
            notes.append(str(speaker_notes).strip())

    return " ".join(note for note in notes if note)


def validatePresentationLength(script: str, target_words: int) -> bool:
    return countWords(script) >= target_words * WORD_COUNT_SHORTFALL_THRESHOLD