"""add the presenter's voice profile to script generations

Mood, profession and experience level: the settings that decide *how* a script
sounds, as opposed to what it is about. Stored on the generation rather than
read off the user at generation time — the wizard can override any of them for
a single script, and a revision has to be written in the same voice as the
script it edits, not in whatever the user's settings happen to say later.

Nullable with no backfill: an older generation has no profile, and
speaker_profile_block() renders nothing for one, so those keep producing exactly
the prompt they always did.

Revision ID: d4a2f81c60b7
Revises: c7a4e91d38b2
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d4a2f81c60b7"
down_revision: Union[str, Sequence[str], None] = "c7a4e91d38b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("script_generations", sa.Column("mood", sa.String(32), nullable=True))
    op.add_column("script_generations", sa.Column("profession", sa.String(32), nullable=True))
    op.add_column(
        "script_generations", sa.Column("experience_level", sa.String(32), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("script_generations", "experience_level")
    op.drop_column("script_generations", "profession")
    op.drop_column("script_generations", "mood")
