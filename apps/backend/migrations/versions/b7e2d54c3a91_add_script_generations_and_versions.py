"""add script_generations and script_versions

Revision ID: b7e2d54c3a91
Revises: 9a1f4c7be2d0
Create Date: 2026-07-29 10:00:00.000000

Moves script generation off the decks table and onto a resource of its own.

Previously a deck row was created the moment the user tapped Generate, and the
script job wrote onto it. Every generation the user discarded or walked away
from therefore left a permanent deck with no cards in their grid. A generation
now owns the brief -> script -> revision lifecycle, and a deck is created only
when the user accepts the result (`script_generations.deck_id`).

`script_versions` is append-only history, one row per completed run, AI revision
and manual edit — which is what the preview screen's undo/redo arrows step
through.

Every enum here is declared with `postgresql.ENUM(create_type=False)` and created
by hand above, rather than being inferred from the columns.
`generation_status_enum` and `audience_type_enum` already exist — decks uses both
— so an inferred CREATE TYPE would abort the migration on "type already exists".
Note that the plain `sa.Enum` does *not* honour `create_type`; it has to be the
dialect-specific one.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "b7e2d54c3a91"
down_revision: Union[str, Sequence[str], None] = "9a1f4c7be2d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


GENERATION_STATUS = postgresql.ENUM(
    "pending",
    "processing",
    "completed",
    "failed",
    "cancelled",
    name="generation_status_enum",
    create_type=False,
)
AUDIENCE_TYPE = postgresql.ENUM(
    "general",
    "executives",
    "students",
    "technical",
    "business",
    "educational",
    "investors",
    "faculty",
    name="audience_type_enum",
    create_type=False,
)
VERSION_KIND = postgresql.ENUM(
    "generated", "revised", "edited", name="script_version_kind_enum", create_type=False
)


def _table_exists(name: str) -> bool:
    return sa.inspect(op.get_bind()).has_table(name)


def upgrade() -> None:
    """Upgrade schema.

    Both tables are created conditionally.

    main.py used to call `Base.metadata.create_all()` on startup, which built
    these tables straight from the models without telling Alembic — so on any
    database that ran the app before this migration, the tables are already
    there while alembic_version still points at a revision before it. An
    unconditional CREATE TABLE would abort the whole upgrade on "already
    exists", stranding every later migration. That call is gone now, but the
    databases it affected still have to be able to move forward.
    """
    # Only this one is new; the other two already exist. Guarded rather than a
    # bare CREATE TYPE so a partially-applied run can be repeated.
    op.execute(
        "DO $$ BEGIN "
        "CREATE TYPE script_version_kind_enum AS ENUM ('generated', 'revised', 'edited'); "
        "EXCEPTION WHEN duplicate_object THEN NULL; END $$"
    )

    if _table_exists("script_generations") and _table_exists("script_versions"):
        # create_all already produced exactly this shape, indexes included.
        # Nothing to do but let the revision be recorded.
        return

    op.create_table(
        "script_generations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("duration_mins", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("card_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("audience", AUDIENCE_TYPE, nullable=False, server_default="general"),
        sa.Column("fingerprint", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("script", sa.Text(), nullable=True),
        sa.Column("status", GENERATION_STATUS, nullable=False, server_default="pending"),
        sa.Column("celery_task_id", sa.String(), nullable=True),
        sa.Column("error", sa.String(), nullable=True),
        sa.Column("deck_id", sa.Integer(), nullable=True),
        sa.Column(
            "last_seen_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        # SET NULL, not CASCADE: deleting a deck must not take the draft it came
        # from with it. The generation falls back to being an unmaterialised
        # draft, which is exactly what it is again at that point.
        sa.ForeignKeyConstraint(["deck_id"], ["decks.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_script_generations_user_id", "script_generations", ["user_id"])
    op.create_index("ix_script_generations_status", "script_generations", ["status"])
    op.create_index("ix_script_generations_deck_id", "script_generations", ["deck_id"])
    op.create_index("ix_script_generations_is_deleted", "script_generations", ["is_deleted"])
    op.create_index("ix_script_generations_fingerprint", "script_generations", ["fingerprint"])
    op.create_index(
        "ix_script_generations_celery_task_id", "script_generations", ["celery_task_id"]
    )
    # The dedupe lookup — "has this user already asked for exactly this brief?"
    op.create_index(
        "ix_script_generations_user_fingerprint",
        "script_generations",
        ["user_id", "fingerprint"],
    )
    # Backs the drafts list.
    op.create_index(
        "ix_script_generations_user_created", "script_generations", ["user_id", "created_at"]
    )

    op.create_table(
        "script_versions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("generation_id", sa.Integer(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(), nullable=False, server_default=""),
        sa.Column("script", sa.Text(), nullable=False),
        sa.Column("kind", VERSION_KIND, nullable=False),
        sa.Column("instruction", sa.String(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["generation_id"], ["script_generations.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_script_versions_generation_id", "script_versions", ["generation_id"])
    op.create_index(
        "ix_script_versions_generation_position",
        "script_versions",
        ["generation_id", "position"],
    )


def downgrade() -> None:
    """Downgrade schema.

    Drops both tables and the one enum type this migration introduced.
    `generation_status_enum` and `audience_type_enum` are left alone — decks
    still uses them.
    """
    op.drop_index("ix_script_versions_generation_position", table_name="script_versions")
    op.drop_index("ix_script_versions_generation_id", table_name="script_versions")
    op.drop_table("script_versions")

    for index in (
        "ix_script_generations_user_created",
        "ix_script_generations_user_fingerprint",
        "ix_script_generations_celery_task_id",
        "ix_script_generations_fingerprint",
        "ix_script_generations_is_deleted",
        "ix_script_generations_deck_id",
        "ix_script_generations_status",
        "ix_script_generations_user_id",
    ):
        op.drop_index(index, table_name="script_generations")
    op.drop_table("script_generations")

    op.execute("DROP TYPE IF EXISTS script_version_kind_enum")
