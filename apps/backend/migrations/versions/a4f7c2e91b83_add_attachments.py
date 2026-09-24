"""add attachments

Files the user uploads to ground a generation in their own material. Replaces
the single-image flow, which kept its S3 key in Redis under a one-hour TTL —
that could describe only one file, held no extracted text, and expired long
before a revision might need it.

Revision ID: a4f7c2e91b83
Revises: 69b0209c0c80
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a4f7c2e91b83"
down_revision: Union[str, Sequence[str], None] = "69b0209c0c80"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "attachments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        # Null until a brief is submitted carrying this attachment's id. SET NULL
        # rather than CASCADE so a deleted generation leaves the row for the
        # orphan sweep to clean up along with its S3 object.
        sa.Column("generation_id", sa.Integer(), nullable=True),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("filename", sa.String(), nullable=False),
        sa.Column("content_type", sa.String(), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("object_key", sa.String(), nullable=False),
        # Extracted once at upload. This is what a revision months later is
        # grounded in, so it outlives the run that first used it.
        sa.Column("extracted_text", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(
            ["generation_id"], ["script_generations.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("object_key"),
    )
    op.create_index("ix_attachments_user_id", "attachments", ["user_id"])
    op.create_index("ix_attachments_generation_id", "attachments", ["generation_id", "id"])


def downgrade() -> None:
    op.drop_index("ix_attachments_generation_id", table_name="attachments")
    op.drop_index("ix_attachments_user_id", table_name="attachments")
    op.drop_table("attachments")
