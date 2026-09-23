"""Persistent onboarding workflow state, one row per user.

The two booleans on ``users`` (``onboarding_completed`` /
``profile_setup_completed``) still answer "has this account finished?", and the
client's router keeps reading them. What they cannot answer is *where* an
unfinished account stopped, which step it was on, what it had already answered,
or which version of the flow it was running. This table is that record.

One row per user rather than a row per step: the flow is a single position, and
the position is what every read wants. Answers that have a real column elsewhere
(the nickname lives on ``users``) are not duplicated here; ``data`` holds the
ones that have no home of their own yet.
"""

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class OnboardingProgress(Base):
    __tablename__ = "onboarding_progress"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    #: One row per account. The unique index is the constraint that keeps a
    #: retried PUT an upsert instead of a second row.
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )

    #: Which version of the flow this position belongs to. Not cosmetic: a step
    #: id from an older flow has to be interpretable after the flow changes.
    flow_version: Mapped[str] = mapped_column(String(32), nullable=False)

    #: "not_started" | "in_progress" | "completed". A string rather than an enum
    #: because the set is the client's and a migration per new state would buy
    #: nothing; the router validates it against the same three values.
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="not_started", server_default="not_started"
    )

    #: The step the user was on, or NULL once completed. This is the field the
    #: client resumes from, and the reason the numeric index is not stored:
    #: reordering the flow must not move someone to a different question.
    current_step_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    #: Step ids already finished. JSON list because the flow is the client's and
    #: changes without a migration; the entries are still validated as strings
    #: at the schema boundary.
    completed_steps: Mapped[list[str]] = mapped_column(
        JSON, nullable=False, default=list, server_default=text("'[]'::json")
    )

    #: Answers that have no column of their own yet. Same reasoning as above.
    data: Mapped[dict[str, Any]] = mapped_column(
        JSON, nullable=False, default=dict, server_default=text("'{}'::json")
    )

    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    #: Bumped on every write. The client compares this against its local
    #: lastUpdatedAt to decide which side of a divergent pair is newer.
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
