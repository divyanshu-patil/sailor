
from pydantic import BaseModel, ConfigDict, Field, model_validator
from typing import List, Literal
from datetime import datetime
from typing import Optional

from app.utils.enums.speaking_style import SpeakingStyle
from app.utils.enums.deck_enums import GenerationStatus, AudienceType


class AttachmentRequest(BaseModel):
    id: str
    type: Literal["pdf", "image", "link", "document"]
    name: str
    uri: str


# There is no DeckCreateRequest any more. The brief that used to create a deck
# now creates a ScriptGeneration instead — see ScriptGenerateRequest in
# script_schema.py — and a deck is built from an accepted script rather than
# from a brief.


class DeckUpdateRequest(BaseModel):
    """Manual (non-AI) edits from the app: the script editor, renaming a deck,
    the favourite toggle. Every field is optional — only what's sent is written.
    Accepts either the snake_case field name or the camelCase alias the mobile
    client uses."""

    model_config = ConfigDict(populate_by_name=True)

    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    script: Optional[str] = Field(default=None, min_length=1)
    is_favorite: Optional[bool] = Field(default=None, alias="isFavourite")
    is_public: Optional[bool] = Field(default=None, alias="isPublic")


class DeckReviseRequest(BaseModel):
    instruction: str = Field(
        ...,
        min_length=3,
        max_length=1000,
        description="What the presenter wants changed about the current script",
    )


class DeckResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    title: Optional[str] = None
    description: Optional[str] = None
    script: Optional[str] = None
    color: str
    duration_mins: int
    card_count: int
    is_favorite: bool
    is_public: bool
    generation_status: GenerationStatus
    generation_error: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class CardResponse(BaseModel):
    id: int
    position: int
    title: str
    description: str
    color: str
    impact: float
    delivery: SpeakingStyle
    
    model_config = ConfigDict(from_attributes=True)


class DeckInfoResponse(BaseModel):
    id: int
    title: str
    description: str
    script: str
    color: str
    duration_mins: int
    card_count: int
    is_favorite: bool
    created_at: datetime


class AllDeckInfoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: Optional[str] = None
    description: str
    color: str
    updatedAt: datetime = Field(alias="updated_at")
    slideCount: int = Field(alias="card_count")
    durationMins: int = Field(alias="duration_mins")
    isFavourite: bool = Field(alias="is_favorite")

class PublicDeckCreator(BaseModel):
    """Just enough about the creator to show a byline — never email,
    clerk_user_id, subscription_tier, or role. Those are account internals,
    not something a stranger browsing the feed should see."""

    id: int
    name: str

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def _from_user(cls, user):

        if isinstance(user, dict):
            return user
        name = getattr(user, "nickname", None) or getattr(user, "full_name", None) or "Anonymous"
        return {"id": user.id, "name": name}


class PublicDeckItem(BaseModel):
    """One public deck as it appears in the infinite-scroll feed. Everything
    the card needs to render itself (title, color, audience, creator byline)
    plus the full script, so tapping into a deck needs no second fetch."""

    id: int
    title: str | None = None
    script: str | None = None
    durationMins: int = Field(alias="duration_mins")
    color: str
    audience: AudienceType
    creator: PublicDeckCreator = Field(alias="user")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class PublicDecksPage(BaseModel):
    """The envelope the feed endpoint returns."""

    items: list[PublicDeckItem]
    nextCursor: str | None = Field(default=None, alias="next_cursor")
    hasMore: bool = Field(alias="has_more")

    model_config = ConfigDict(populate_by_name=True)