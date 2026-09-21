"""add streak restore

Revision ID: f9a3c07d21e8
Revises: c5f2a8d31e07
Create Date: 2026-09-21

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f9a3c07d21e8"
down_revision: Union[str, Sequence[str], None] = "c5f2a8d31e07"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Backfilled to 0, not to streak_count: every existing lapsed streak was
    # already zeroed on read before this column existed, so there is no honest
    # value to recover. Nobody gets a free restore of a streak we cannot prove.
    op.add_column(
        "users",
        sa.Column(
            "lapsed_streak", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
    )
    op.add_column("users", sa.Column("last_restore_on", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "last_restore_on")
    op.drop_column("users", "lapsed_streak")
