"""add public deck metadata (tags, category, practice count, published_at)

Publishing moved off the script-generation brief and onto the deck itself, so
`script_generations.is_public` goes away with it: a deck is published from its
own detail screen, after it exists, with metadata a brief never collected.

Revision ID: d21a9c4e77b1
Revises: 54fc326a4193
Create Date: 2026-08-16

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "d21a9c4e77b1"
down_revision: Union[str, Sequence[str], None] = "54fc326a4193"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


CATEGORIES = (
    "interview",
    "sales",
    "academic",
    "business",
    "conference",
    "social",
    "teaching",
    "other",
)

deck_category_enum = postgresql.ENUM(*CATEGORIES, name="deck_category_enum")


def upgrade() -> None:
    deck_category_enum.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "decks",
        sa.Column(
            "tags",
            postgresql.ARRAY(sa.String()),
            server_default=sa.text("'{}'::varchar[]"),
            nullable=False,
        ),
    )
    op.add_column("decks", sa.Column("category", deck_category_enum, nullable=True))
    op.add_column(
        "decks",
        sa.Column("practice_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
    )
    op.add_column(
        "decks", sa.Column("published_at", sa.DateTime(timezone=True), nullable=True)
    )

    # Decks that were already public under the old toggle have no published_at,
    # and the feed orders by it — without this backfill they'd sort last (NULL)
    # or vanish behind the keyset cursor entirely.
    op.execute(
        "UPDATE decks SET published_at = created_at "
        "WHERE is_public = true AND published_at IS NULL"
    )

    # The old feed index ordered by created_at; the feed now orders by
    # published_at, plus a popularity order and a tag filter.
    op.drop_index("ix_decks_public_feed", table_name="decks", if_exists=True)
    op.create_index(
        "ix_decks_public_recent",
        "decks",
        ["published_at", "id"],
        postgresql_where=sa.text("is_public = true AND is_deleted = false"),
    )
    op.create_index(
        "ix_decks_public_popular",
        "decks",
        ["practice_count", "id"],
        postgresql_where=sa.text("is_public = true AND is_deleted = false"),
    )
    op.create_index(
        "ix_decks_public_tags",
        "decks",
        ["tags"],
        postgresql_using="gin",
        postgresql_where=sa.text("is_public = true AND is_deleted = false"),
    )

    op.drop_column("script_generations", "is_public")


def downgrade() -> None:
    op.add_column(
        "script_generations",
        sa.Column("is_public", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )

    op.drop_index("ix_decks_public_tags", table_name="decks")
    op.drop_index("ix_decks_public_popular", table_name="decks")
    op.drop_index("ix_decks_public_recent", table_name="decks")
    op.create_index(
        "ix_decks_public_feed",
        "decks",
        ["is_public", "created_at", "id"],
        postgresql_where=sa.text("is_public = true AND is_deleted = false"),
    )

    op.drop_column("decks", "published_at")
    op.drop_column("decks", "practice_count")
    op.drop_column("decks", "category")
    op.drop_column("decks", "tags")

    deck_category_enum.drop(op.get_bind(), checkfirst=True)
