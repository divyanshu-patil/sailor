"""add onboarding completion flags

Revision ID: a1b7e4c93d20
Revises: f9a3c07d21e8
Create Date: 2026-09-21

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a1b7e4c93d20"
down_revision: Union[str, Sequence[str], None] = "f9a3c07d21e8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Backfilled false: the flags have only ever lived on the device until now,
    # so the server has no way to know who has already been through the flow.
    # Existing users' local flags still short-circuit it (see the client's
    # useOnboardingCompletionStore), so nobody repeats onboarding on the device
    # they are already using.
    op.add_column(
        "users",
        sa.Column(
            "onboarding_completed",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "profile_setup_completed",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "profile_setup_completed")
    op.drop_column("users", "onboarding_completed")
