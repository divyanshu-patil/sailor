"""persistent onboarding progress + case-insensitive nickname uniqueness

Replaces "has this account seen onboarding?" (a boolean) with a position the app
can resume from after a kill, a reinstall or a second device. Two changes:

`onboarding_progress` is a new one-row-per-user table holding the flow version,
the current step id, the completed step ids, the answers that have no column of
their own, and a completion timestamp. Idempotent upsert on the unique user_id.

`users.nickname_normalized` is the canonical form of `nickname` (case-folded,
whitespace-collapsed) and carries a partial unique index. The visible nickname
keeps its capitalization; uniqueness runs on the normalized column so "Alex",
"alex" and " ALEX " are one identity. Partial because nickname is optional and
any number of accounts may have none.

Backfill: existing nicknames are normalized in Python. Where two rows normalize
to the same value the later ones are left NULL rather than edited or deleted --
nothing here has been exposed to uniqueness before, so the users who collide can
choose a new name, and the index can still be built.

Revision ID: c7a1e9f30b52
Revises: b4e17c9a2f83
Create Date: 2026-09-23

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "c7a1e9f30b52"
down_revision: Union[str, Sequence[str], None] = "b4e17c9a2f83"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _normalize(raw: str) -> str:
    return " ".join(raw.strip().split()).casefold()


def upgrade() -> None:
    connection = op.get_bind()

    # --- users.nickname_normalized ---------------------------------------
    op.add_column(
        "users", sa.Column("nickname_normalized", sa.String(length=64), nullable=True)
    )

    rows = connection.execute(
        sa.text("SELECT id, nickname FROM users WHERE nickname IS NOT NULL")
    ).fetchall()
    seen: set[str] = set()
    for user_id, nickname in rows:
        normalized = _normalize(nickname or "")
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        connection.execute(
            sa.text(
                "UPDATE users SET nickname_normalized = :normalized WHERE id = :id"
            ),
            {"normalized": normalized, "id": user_id},
        )

    op.create_index(
        "uq_users_nickname_normalized",
        "users",
        ["nickname_normalized"],
        unique=True,
        postgresql_where=sa.text("nickname_normalized IS NOT NULL"),
    )

    # --- onboarding_progress ---------------------------------------------
    op.create_table(
        "onboarding_progress",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("flow_version", sa.String(length=32), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="not_started",
        ),
        sa.Column("current_step_id", sa.String(length=64), nullable=True),
        sa.Column(
            "completed_steps",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[]'::json"),
        ),
        sa.Column(
            "data",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'{}'::json"),
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_onboarding_progress_user_id",
        "onboarding_progress",
        ["user_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_onboarding_progress_user_id", table_name="onboarding_progress")
    op.drop_table("onboarding_progress")
    op.drop_index("uq_users_nickname_normalized", table_name="users")
    op.drop_column("users", "nickname_normalized")
