"""add cancelled generation status and faculty audience

Revision ID: 9a1f4c7be2d0
Revises: 5234a8070d12
Create Date: 2026-07-27 17:05:00.000000

Two new enum values:

- generation_status_enum gains 'cancelled', so an explicit user stop is
  distinguishable from a genuine failure (used by both generation_status and
  cards_generation_status).
- audience_type_enum gains 'faculty', for the "faculty evaluating presentation
  skills" audience the script prompt is tuned around.

ADD VALUE runs inside the migration's transaction, which Postgres allows from 12
onward provided the new value isn't also *used* in that same transaction — it
isn't here, so no autocommit escape hatch is needed.
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9a1f4c7be2d0"
down_revision: Union[str, Sequence[str], None] = "5234a8070d12"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("ALTER TYPE generation_status_enum ADD VALUE IF NOT EXISTS 'cancelled'")
    op.execute("ALTER TYPE audience_type_enum ADD VALUE IF NOT EXISTS 'faculty'")


def downgrade() -> None:
    """Downgrade schema.

    Postgres has no DROP VALUE, so each type is rebuilt without the added value.
    Existing rows have to be moved off it first — a cancelled job becomes
    'failed' and a faculty deck becomes 'educational', both being the closest
    surviving value — and the column defaults have to come off before the type
    swap, because a default carries a cast to the type being replaced.
    """
    op.execute("UPDATE decks SET generation_status = 'failed' WHERE generation_status = 'cancelled'")
    op.execute(
        "UPDATE decks SET cards_generation_status = 'failed' "
        "WHERE cards_generation_status = 'cancelled'"
    )
    op.execute("UPDATE decks SET audience = 'educational' WHERE audience = 'faculty'")

    op.execute("ALTER TABLE decks ALTER COLUMN generation_status DROP DEFAULT")
    op.execute("ALTER TABLE decks ALTER COLUMN cards_generation_status DROP DEFAULT")
    op.execute("ALTER TYPE generation_status_enum RENAME TO generation_status_enum_old")
    op.execute(
        "CREATE TYPE generation_status_enum AS ENUM "
        "('pending', 'processing', 'completed', 'failed')"
    )
    op.execute(
        "ALTER TABLE decks ALTER COLUMN generation_status TYPE generation_status_enum "
        "USING generation_status::text::generation_status_enum"
    )
    op.execute(
        "ALTER TABLE decks ALTER COLUMN cards_generation_status TYPE generation_status_enum "
        "USING cards_generation_status::text::generation_status_enum"
    )
    op.execute("DROP TYPE generation_status_enum_old")
    op.execute(
        "ALTER TABLE decks ALTER COLUMN generation_status "
        "SET DEFAULT 'pending'::generation_status_enum"
    )
    op.execute(
        "ALTER TABLE decks ALTER COLUMN cards_generation_status "
        "SET DEFAULT 'pending'::generation_status_enum"
    )

    op.execute("ALTER TABLE decks ALTER COLUMN audience DROP DEFAULT")
    op.execute("ALTER TYPE audience_type_enum RENAME TO audience_type_enum_old")
    op.execute(
        "CREATE TYPE audience_type_enum AS ENUM "
        "('general', 'executives', 'students', 'technical', 'business', "
        "'educational', 'investors')"
    )
    op.execute(
        "ALTER TABLE decks ALTER COLUMN audience TYPE audience_type_enum "
        "USING audience::text::audience_type_enum"
    )
    op.execute("DROP TYPE audience_type_enum_old")
    op.execute("ALTER TABLE decks ALTER COLUMN audience SET DEFAULT 'general'::audience_type_enum")
