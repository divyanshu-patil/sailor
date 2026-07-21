"""add deck generation status tracking"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "1c42cbafb5bb"
down_revision: Union[str, Sequence[str], None] = "063c8b0da287"
branch_labels = None
depends_on = None

audience_type_enum = sa.Enum(
    "general",
    "executives",
    "students",
    "technical",
    "business",
    "educational",
    "investors",
    name="audience_type_enum",
)


def upgrade() -> None:
    bind = op.get_bind()

    # Create the PostgreSQL enum type first
    audience_type_enum.create(bind, checkfirst=True)

    op.add_column(
        "decks",
        sa.Column(
            "audience",
            audience_type_enum,
            nullable=False,
            server_default="general",
        ),
    )

def downgrade() -> None:
    bind = op.get_bind()

    op.drop_column("decks", "audience")

    audience_type_enum.drop(bind, checkfirst=True)