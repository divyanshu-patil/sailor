"""add generation links

Reference URLs the presenter supplied with the brief. On the generation rather
than in `attachments`: a link has no object in S3, no size and nothing to
extract, so an attachment row would be almost entirely null.

Revision ID: b8d1e35a07c4
Revises: a4f7c2e91b83
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b8d1e35a07c4"
down_revision: Union[str, Sequence[str], None] = "a4f7c2e91b83"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "script_generations",
        sa.Column("links", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("script_generations", "links")
