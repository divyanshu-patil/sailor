"""add entitlement_checked_at — makes subscription_tier a cache with a TTL

users.subscription_tier already existed but nothing ever wrote it, so every
account read as free while the only real gate lived in the client. The quota
service now fills it from RevenueCat, and a cached value is only usable if you
know how old it is — that's this column.

Nullable with no backfill on purpose: null means "never checked", which is
exactly right for every existing row, and reads as stale so the first gated
request each user makes looks their entitlement up.

Revision ID: c7a4e91d38b2
Revises: a1c9b47e2d05
Create Date: 2026-08-18

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "c7a4e91d38b2"
down_revision: Union[str, Sequence[str], None] = "a1c9b47e2d05"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("entitlement_checked_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "entitlement_checked_at")
