from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class OnboardingProgressResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    flow_version: str
    status: str
    current_step_id: Optional[str] = None
    completed_steps: list[str] = Field(default_factory=list)
    data: dict[str, Any] = Field(default_factory=dict)
    completed_at: Optional[datetime] = None
    #: None when the account has never written progress — the GET answers with
    #: a transient "not_started" shape rather than creating a row for everyone.
    updated_at: Optional[datetime] = None


class OnboardingProgressUpdateRequest(BaseModel):
    """A full-state write. PUT rather than PATCH on purpose: the client is the
    authority on its own position, and a partial write would make two devices
    editing different fields race into a position neither chose."""

    flow_version: str = Field(..., max_length=32)
    status: str = Field(..., pattern="^(not_started|in_progress|completed)$")
    current_step_id: Optional[str] = Field(default=None, max_length=64)
    completed_steps: list[str] = Field(default_factory=list, max_length=64)
    data: dict[str, Any] = Field(default_factory=dict)
    completed_at: Optional[datetime] = None


class NicknameAvailabilityResponse(BaseModel):
    #: The display form after trimming/collapsing, so the client can show what
    #: it would actually save.
    nickname: str
    normalized: str
    available: bool
    #: "taken" | "invalid" | None. Never a substitute for the 409 on the final
    #: save — another device can claim the name in the gap.
    reason: Optional[str] = None
