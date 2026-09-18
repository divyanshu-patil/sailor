"""daily practice frameworks + cryptographic user public_id

Two changes that landed together because the second exists to serve the first.

`daily_content.type` -> `daily_content.framework`. The old column held vague
subjects ("structure", "general_tip") which produced content that described a
topic instead of teaching a repeatable move. It now holds an id from
services/daily/frameworks.py (PREP, STAR, SCQA, ...). Existing rows are deleted
rather than migrated: there is no mapping from "structure" to a named framework,
and the table is a regenerable buffer — the worker's startup refill rebuilds it
within seconds of the next boot. That is the whole point of generating ahead.

`users.public_id` is a 32-character cryptographically random hex, unique per
user. `users.id` remains the integer primary key — every foreign key in the
schema points at it. This is an additional identifier, added because the integer
is guessable: it is 1, 2, 3, 4 in signup order, and daily practice derives each
user's content variation from it. Hashing a sequence number makes a user's whole
schedule of variations derivable from their position in the signup queue.

Existing rows are backfilled here with `secrets.token_hex`, one value per row,
rather than from SQL. Postgres's `random()` is not a cryptographic source and
`gen_random_bytes` needs pgcrypto, which this database does not require.

Revision ID: b4d9e7f18c23
Revises: e8b16f2a5c40
Create Date: 2026-09-18

"""
import secrets
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "b4d9e7f18c23"
down_revision: Union[str, Sequence[str], None] = "e8b16f2a5c40"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    connection = op.get_bind()

    # --- users.public_id -------------------------------------------------
    op.add_column("users", sa.Column("public_id", sa.String(length=32), nullable=True))

    user_ids = connection.execute(sa.text("SELECT id FROM users")).scalars().all()
    for user_id in user_ids:
        # One fresh value per row. Generated in Python so every identifier —
        # backfilled or newly inserted — comes from the same CSPRNG.
        connection.execute(
            sa.text("UPDATE users SET public_id = :public_id WHERE id = :id"),
            {"public_id": secrets.token_hex(16), "id": user_id},
        )

    op.alter_column("users", "public_id", nullable=False)
    op.create_index("ix_users_public_id", "users", ["public_id"], unique=True)

    # --- daily_content.type -> framework ---------------------------------
    # Cleared, not converted: no old value maps onto a named framework, and the
    # buffer regenerates itself.
    connection.execute(sa.text("DELETE FROM daily_content"))
    op.drop_column("daily_content", "type")
    op.add_column(
        "daily_content", sa.Column("framework", sa.String(length=48), nullable=False)
    )


def downgrade() -> None:
    connection = op.get_bind()

    connection.execute(sa.text("DELETE FROM daily_content"))
    op.drop_column("daily_content", "framework")
    op.add_column("daily_content", sa.Column("type", sa.String(length=32), nullable=False))

    op.drop_index("ix_users_public_id", table_name="users")
    op.drop_column("users", "public_id")
