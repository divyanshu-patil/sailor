"""add deck_saves — bookmarking a public deck

A save is a reference, not a copy: the row is (user, deck), so a saved deck
stays the author's, keeps their edits, and leaves everyone's saved list when
they unpublish it.

Revision ID: f3c7d21b58a4
Revises: e5b3a1f60c92
Create Date: 2026-08-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f3c7d21b58a4"
down_revision: Union[str, Sequence[str], None] = "e5b3a1f60c92"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "deck_saves",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("deck_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["deck_id"], ["decks.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        # Named, because the save endpoint's ON CONFLICT targets it by name.
        sa.UniqueConstraint("user_id", "deck_id", name="uq_deck_saves_user_deck"),
    )
    op.create_index("ix_deck_saves_user_created", "deck_saves", ["user_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_deck_saves_user_created", table_name="deck_saves")
    op.drop_table("deck_saves")
