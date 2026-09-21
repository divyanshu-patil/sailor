"""add lapsed_on for the streak restore window

Revision ID: c8d2f61a904b
Revises: a1b7e4c93d20
Create Date: 2026-09-21

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c8d2f61a904b"
down_revision: Union[str, Sequence[str], None] = "a1b7e4c93d20"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("lapsed_on", sa.Date(), nullable=True))

    # Backfill the break date for anyone already holding a restorable streak,
    # so the window applies to them from the right day instead of leaving them
    # with a null deadline (which reads as "no expiry" and would keep the old
    # unlimited behaviour alive for exactly the people it was written for).
    #
    # A streak survives the day after its last practice and is gone the day
    # after that, so the break is last_practiced_on + 2 — the same derivation
    # the controller uses.
    op.execute(
        """
        UPDATE users
           SET lapsed_on = last_practiced_on + INTERVAL '2 days'
         WHERE lapsed_streak > 0
           AND lapsed_on IS NULL
           AND last_practiced_on IS NOT NULL
        """
    )


def downgrade() -> None:
    op.drop_column("users", "lapsed_on")
