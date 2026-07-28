# app/services/decks/deck_colors.py
"""
Deck cover colours.

This module is the only place a deck's colour is decided — never the model, and
never the client. The palette is the app's own: the mobile theme's #F4D35E plus
the deck colours the deck grid and detail screens were designed against, so a
generated deck can never come back in a shade the UI wasn't built for.

Everything here is deliberately muted. A deck colour is a large flat fill sitting
behind dark text on the deck card, the detail header and the practice view, so
anything saturated enough to fight that text is out by construction — which is
why the old ["#FF5733", "#33A1FF", "#8E44AD", ...] set had to go.

Card colours are a separate, independent concern: see
app/services/cards/impact_colors.py, which ranks by impact within a deck.
"""
import random

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.deck_model import Deck

# Ordered roughly warm -> cool so neighbouring picks stay visually distinct.
DECK_PALETTE: list[str] = [
    "#F4D35E",  # soft mustard — the mobile theme's accent
    "#FFC88A",  # warm apricot
    "#F78199",  # muted coral
    "#EFC1FF",  # pale orchid
    "#A0A3FF",  # periwinkle
    "#A1AFDE",  # dusty blue
    "#ACCCC0",  # sage
]


def pick_deck_color(user_id: int, db: Session) -> str:
    """
    Picks a palette colour for a new deck, avoiding whatever the user's most
    recent deck used.

    Without that check a plain random choice hands out the same colour twice in
    a row often enough to be noticeable — with a seven-colour palette it's about
    one deck in seven, and two identical tiles side by side in the grid read as a
    bug rather than a coincidence.
    """
    most_recent = db.execute(
        select(Deck.color)
        .where(Deck.user_id == user_id, Deck.is_deleted == False)  # noqa: E712
        .order_by(Deck.created_at.desc())
        .limit(1)
    ).scalar_one_or_none()

    choices = [c for c in DECK_PALETTE if c != most_recent] or DECK_PALETTE
    return random.choice(choices)
