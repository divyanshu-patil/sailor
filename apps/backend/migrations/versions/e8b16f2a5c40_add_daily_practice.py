"""add daily practice — pre-generated content buffer and per-user streak

`daily_content` holds snippets generated days ahead by the beat task, keyed by
(date, variation_index): one row per variation, no per-user rows at all. Which
variation a user sees is a hash of (user_id, date) resolved at read time, so
there is nothing here to write when someone opens the app.

The streak lives on `users` rather than in a table of its own — one row per user,
never read without the user. `last_practiced_on` is a plain Date because it is
the user's *local* calendar day, sent by the client; a timestamp would invite
comparing it in UTC, which is exactly the bug that breaks streaks for anyone not
on GMT.

Revision ID: e8b16f2a5c40
Revises: d4a2f81c60b7
Create Date: 2026-09-17

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "e8b16f2a5c40"
down_revision: Union[str, Sequence[str], None] = "d4a2f81c60b7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "daily_content",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("type", sa.String(length=32), nullable=False),
        sa.Column("mood", sa.String(length=32), nullable=False),
        sa.Column("situation", sa.String(length=32), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("tip", sa.Text(), nullable=False),
        sa.Column("variation_index", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("date", "variation_index", name="uq_daily_content_date_variation"),
    )
    op.create_index("ix_daily_content_date", "daily_content", ["date"])

    op.add_column(
        "users",
        sa.Column("streak_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
    )
    op.add_column(
        "users",
        sa.Column("longest_streak", sa.Integer(), server_default=sa.text("0"), nullable=False),
    )
    op.add_column("users", sa.Column("last_practiced_on", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "last_practiced_on")
    op.drop_column("users", "longest_streak")
    op.drop_column("users", "streak_count")
    op.drop_index("ix_daily_content_date", table_name="daily_content")
    op.drop_table("daily_content")
