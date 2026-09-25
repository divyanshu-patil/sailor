"""drop users.full_name

The app identifies people by nickname only; the name collected at sign-up is
no longer asked for, shown or stored.

Revision ID: b7d2e94a1c60
Revises: a2f5c8e01d3b
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b7d2e94a1c60"
down_revision: Union[str, Sequence[str], None] = "a2f5c8e01d3b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("users", "full_name")


def downgrade() -> None:
    op.add_column("users", sa.Column("full_name", sa.String(length=100), nullable=True))
