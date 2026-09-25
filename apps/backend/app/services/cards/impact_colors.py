# app/services/cards/impact_colors.py
"""
Card color assignment. The AI (Step 5) only ever produces an `impact` score; this
module is the *only* place color is decided, purely from where that score ranks
against the rest of the deck's cards — never a fixed threshold, and never touched
by the model.
"""
from app.models.card_model import Card

IMPACT_PALETTES: list[list[str]] = [
    ["#C9E4DE", "#B8E0D2", "#CDE7E0", "#D6EAE3"],  # lowest impact
    ["#A0D2DB", "#B5E2EE", "#C2E7F0", "#AED9E0"],
    ["#FFE8B6", "#FFEFC3", "#FCE8A6", "#FFE5A0"],
    ["#FFC8A2", "#FFD3B0", "#FFCBA4", "#FCC9A6"],
    ["#F7A7A6", "#F8B4B3", "#F9ACAB", "#F6A0A3"],  # highest impact
]


def assign_colors_by_impact(cards: list[Card]) -> None:
    """
    Mutates each card's `.color` in place, in place, based on its RANK among the
    given cards, not its absolute impact value. That's what makes it correct to
    call this on a deck's full card set every time it changes: a card that reads as
    "high impact" in a deck full of dramatic moments and one that reads the same in
    a much calmer deck can land in different tiers — color reflects relative
    emphasis *within this deck*, not a fixed cutoff. Always pass the deck's
    complete current card set, never a subset, or the ranking will be wrong.
    """
    n = len(cards)
    if n == 0:
        return

    tier_count = len(IMPACT_PALETTES)
    ranked = sorted(cards, key=lambda c: float(c.impact))

    for rank, card in enumerate(ranked):
        tier = min(tier_count - 1, (rank * tier_count) // n)
        palette = IMPACT_PALETTES[tier]
        card.color = palette[rank % len(palette)]
