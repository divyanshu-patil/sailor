"""drop unique nickname constraint

Nicknames are no longer an identity key: two accounts may share one. This drops
the partial unique index behind that constraint and leaves `nickname_normalized`
in place as the case-folded, whitespace-collapsed form the app still writes.

Revision ID: a2f5c8e01d3b
Revises: c7a1e9f30b52
Create Date: 2026-09-25

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a2f5c8e01d3b"
down_revision: Union[str, Sequence[str], None] = "c7a1e9f30b52"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index("uq_users_nickname_normalized", table_name="users")


def downgrade() -> None:
    # Recreating can fail if duplicates were chosen while the constraint was
    # gone; that is the honest failure for a downgrade that reasserts uniqueness.
    op.create_index(
        "uq_users_nickname_normalized",
        "users",
        ["nickname_normalized"],
        unique=True,
        postgresql_where=sa.text("nickname_normalized IS NOT NULL"),
    )
