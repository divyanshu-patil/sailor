"""add deck description

Revision ID: 260995076720
Revises: 1c42cbafb5bb
Create Date: 2026-07-20 18:23:02.691279
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "260995076720"
down_revision: Union[str, Sequence[str], None] = "1c42cbafb5bb"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "decks",
        sa.Column("description", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("decks", "description")