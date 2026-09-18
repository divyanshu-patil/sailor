"""add daily_content.title — what the snippet is about

The intro screen's "Today's topic" was showing the framework name ("Feynman"),
which answers a different question: the framework is HOW the snippet is
structured, not what it is about. There was no field for the topic at all, so
this adds one and the generator now writes it per variation.

Backfilled to empty rather than guessed. The controller falls back to the
framework's short name for any row without a title, so existing content keeps
rendering until the next regeneration replaces it.

Revision ID: c5f2a8d31e07
Revises: b4d9e7f18c23
Create Date: 2026-09-18

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "c5f2a8d31e07"
down_revision: Union[str, Sequence[str], None] = "b4d9e7f18c23"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "daily_content",
        sa.Column("title", sa.String(length=120), nullable=False, server_default=""),
    )


def downgrade() -> None:
    op.drop_column("daily_content", "title")
