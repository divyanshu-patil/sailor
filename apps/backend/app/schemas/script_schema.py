import re
from datetime import datetime
from typing import Optional
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field, field_validator

# host[:port], optionally with userinfo. Deliberately strict: it is the second
# half of the link whitelist, and what stops a netloc that merely *parsed*.
_HOSTNAME = re.compile(
    r"^(?:[^\s/@]+@)?[A-Za-z0-9\-._~%]+(?::\d{1,5})?$"
)

from app.utils.enums.deck_enums import AudienceType, GenerationStatus, ScriptVersionKind


class ScriptGenerateRequest(BaseModel):
    """The brief. Identical field set to the old DeckCreateRequest, including the
    camelCase aliases the mobile client sends — what changed is that this no
    longer creates a deck."""

    model_config = ConfigDict(populate_by_name=True)

    description: str = Field(..., min_length=10, description="Presentation topic or prompt")
    card_count: int = Field(..., alias="cardCount", ge=1, le=100)
    duration_mins: int = Field(..., alias="durationMinutes", ge=1, le=60)
    audience: AudienceType
    # Ids from POST /attachments. The files are already stored by the time this
    # brief is submitted — see script_controller.start_generation.
    attachment_ids: list[int] = Field(
        default_factory=list, alias="attachmentIds", max_length=20
    )
    # Reference URLs the presenter typed into the wizard. Validated below —
    # anything that isn't an http(s) URL is dropped rather than 422ing the
    # brief, since a malformed link is not a reason to refuse the script.
    links: list[str] = Field(default_factory=list, max_length=20)

    @field_validator("links")
    @classmethod
    def _keep_only_web_urls(cls, links: list[str]) -> list[str]:
        """Drop anything that isn't a plain web URL.

        The scheme is checked *before* the bare-hostname fixup, not after.
        Prefixing first turns `javascript:alert(1)` into
        `https://javascript:alert(1)`, which parses with a netloc and passes —
        so the fixup has to be reserved for input that carries no scheme at all.
        """
        cleaned: list[str] = []
        for link in links:
            candidate = link.strip()
            if not candidate:
                continue

            parsed = urlparse(candidate)
            if parsed.scheme:
                if parsed.scheme.lower() not in ("http", "https"):
                    continue
            else:
                # Users type "example.com" — make it a URL rather than
                # discarding it. Only reached when no scheme was supplied.
                candidate = f"https://{candidate}"
                parsed = urlparse(candidate)

            if not parsed.netloc or not _HOSTNAME.match(parsed.netloc):
                continue
            cleaned.append(candidate[:2000])
        return cleaned


class ScriptEditRequest(BaseModel):
    """Manual edit from the script editor — the complete replacement text."""

    script: str = Field(..., min_length=1)
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)


class ScriptReviseRequest(BaseModel):
    instruction: str = Field(
        ...,
        min_length=3,
        max_length=1000,
        description="What the presenter wants changed about the current script",
    )


class ScriptVersionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    position: int
    title: str
    script: str
    kind: ScriptVersionKind
    instruction: Optional[str] = None
    created_at: datetime


class ScriptGenerationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    description: str
    duration_mins: int
    card_count: int
    audience: AudienceType
    title: Optional[str] = None
    script: Optional[str] = None
    status: GenerationStatus
    error: Optional[str] = None
    # Non-null once the user accepted this script — which is precisely what
    # separates a draft from a finished deck, so the client keys "can this still
    # be resumed?" off it rather than off the status.
    deck_id: Optional[int] = None
    version_count: int = 0
    created_at: datetime
    updated_at: datetime


class ScriptGenerationSummary(BaseModel):
    """The drafts list. No `script` field on purpose — this endpoint returns
    every unfinished generation a user has, and shipping a full script for each
    would make the list several hundred KB for a heavy user."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    description: str
    duration_mins: int
    card_count: int
    audience: AudienceType
    title: Optional[str] = None
    status: GenerationStatus
    deck_id: Optional[int] = None
    version_count: int = 0
    created_at: datetime
    updated_at: datetime


class DeckBuildStatusResponse(BaseModel):
    """Progress of turning an accepted script into a deck.

    `deck_id` stays null for the whole job and is filled in only at the end,
    because the deck genuinely does not exist until its cards do — it and the
    cards are written in one transaction. A client that sees a deck_id can rely
    on the deck being complete.
    """

    status: str
    deck_id: Optional[int] = None
    error: Optional[str] = None


class ScriptStartResponse(BaseModel):
    """Returned by POST /scripts.

    `reused` is the whole point of the endpoint: it tells the client whether it
    got a fresh job or was handed back one that was already running or already
    finished for the same brief, so the preview screen knows not to reset itself
    or start over."""

    generation: ScriptGenerationResponse
    reused: bool = False
