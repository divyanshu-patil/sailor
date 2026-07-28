"""track card generation on the generation, and purge existing ghost decks

Revision ID: c3f81a67d420
Revises: b7e2d54c3a91
Create Date: 2026-07-29 15:30:00.000000

Two changes, both aimed at the same thing: a deck should never be observable
without its cards.

1. `script_generations` gains cards_status / cards_celery_task_id / cards_error.
   Card generation now runs against the generation, before any deck exists, and
   the deck plus its cards are written in one transaction when it finishes. The
   deck row used to be inserted first and filled in afterwards, which is why
   tapping Create made an empty deck appear immediately.

2. Decks left behind by that old flow are soft-deleted. A deck with no cards is
   an artefact of a card job that never finished — there is nothing in it to
   look at, and it can't be repaired, because the brief that would regenerate it
   now lives on a generation these decks predate.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "c3f81a67d420"
down_revision: Union[str, Sequence[str], None] = "b7e2d54c3a91"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

GENERATION_STATUS = postgresql.ENUM(
    "pending",
    "processing",
    "completed",
    "failed",
    "cancelled",
    name="generation_status_enum",
    create_type=False,
)


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "script_generations",
        sa.Column(
            "cards_status", GENERATION_STATUS, nullable=False, server_default="pending"
        ),
    )
    op.add_column(
        "script_generations", sa.Column("cards_celery_task_id", sa.String(), nullable=True)
    )
    op.add_column("script_generations", sa.Column("cards_error", sa.String(), nullable=True))
    op.create_index(
        "ix_script_generations_cards_task",
        "script_generations",
        ["cards_celery_task_id"],
    )

    # Generations that already produced a deck are done — mark their card job
    # complete so they aren't offered as buildable drafts.
    op.execute(
        "UPDATE script_generations SET cards_status = 'completed' WHERE deck_id IS NOT NULL"
    )

    # Ghost decks: no cards, and never going to have any. Soft-deleted rather
    # than dropped, matching how a user delete behaves — the rows stay
    # recoverable and nothing referencing them breaks.
    op.execute(
        """
        UPDATE decks
           SET is_deleted = true,
               deleted_at = now()
         WHERE is_deleted = false
           AND NOT EXISTS (SELECT 1 FROM cards WHERE cards.deck_id = decks.id)
        """
    )


def downgrade() -> None:
    """Downgrade schema.

    The ghost-deck cleanup is not reversed: which decks were empty *before* this
    migration ran is not recorded anywhere, so un-deleting by the same predicate
    would also resurrect decks the user deleted themselves.
    """
    op.drop_index("ix_script_generations_cards_task", table_name="script_generations")
    op.drop_column("script_generations", "cards_error")
    op.drop_column("script_generations", "cards_celery_task_id")
    op.drop_column("script_generations", "cards_status")
