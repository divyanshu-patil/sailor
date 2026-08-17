"""index deck_saves by deck — the save count on a public deck card

The count is read live from deck_saves rather than kept in a counter column on
decks: the rows are already the source of truth, and a denormalised counter can
only ever drift away from them. What that needs is an index on deck_id — the
existing unique constraint leads with user_id, so counting one deck's saves
without this is a sequential scan of the whole table.

Revision ID: a1c9b47e2d05
Revises: f3c7d21b58a4
Create Date: 2026-08-18

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "a1c9b47e2d05"
down_revision: Union[str, Sequence[str], None] = "f3c7d21b58a4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index("ix_deck_saves_deck_id", "deck_saves", ["deck_id"])


def downgrade() -> None:
    op.drop_index("ix_deck_saves_deck_id", table_name="deck_saves")
