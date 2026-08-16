
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from typing import List, Literal
from datetime import datetime
from typing import Optional

from app.utils.enums.speaking_style import SpeakingStyle
from app.utils.enums.deck_enums import DeckCategory, GenerationStatus, AudienceType


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
    # `is_public` is deliberately *not* here. Publishing is an explicit,
    # validated action (POST /decks/{id}/publish) because it can't happen
    # without a description, tags and a category — a PATCH that flipped the flag
    # would put a deck in the feed with none of them.


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
    # Retained after an unpublish, so the publish sheet reopens pre-filled.
    tags: list[str] = Field(default_factory=list)
    category: Optional[DeckCategory] = None
    practice_count: int = 0
    published_at: Optional[datetime] = None
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
    """One public deck as it appears in the discover grid.

    Everything the card renders and nothing more — in particular *not* the
    script. A page is 20 of these, and 20 full scripts is a payload measured in
    hundreds of kilobytes for text no card ever shows. Tapping a card fetches
    the detail below.
    """

    id: int
    title: str | None = None
    description: str | None = None
    durationMins: int = Field(alias="duration_mins")
    slideCount: int = Field(alias="card_count")
    color: str
    audience: AudienceType
    tags: list[str] = Field(default_factory=list)
    category: DeckCategory | None = None
    practiceCount: int = Field(default=0, alias="practice_count")
    publishedAt: datetime | None = Field(default=None, alias="published_at")
    creator: PublicDeckCreator = Field(alias="user")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class PublicDeckDetail(PublicDeckItem):
    """The deck behind a tapped card. Adds the script; the cards themselves come
    from `GET /decks/{id}/cards`, which serves a published deck to anyone."""

    script: str | None = None
    # False for a signed-out reader, which is also what they see: the save
    # button asks them to sign in rather than lying about their state.
    isSaved: bool = Field(default=False, alias="is_saved")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class PublicDecksPage(BaseModel):
    """The envelope the feed endpoint returns."""

    items: list[PublicDeckItem]
    nextCursor: str | None = Field(default=None, alias="next_cursor")
    hasMore: bool = Field(alias="has_more")

    model_config = ConfigDict(populate_by_name=True)


class DeckPublishRequest(BaseModel):
    """What the review sheet collects before a deck can enter discovery.

    All three are required — a feed of untitled, uncategorised decks is not
    browsable — and they're validated here rather than in the controller so a
    bad payload never reaches the visibility switch.
    """

    model_config = ConfigDict(populate_by_name=True)

    description: str = Field(..., min_length=10, max_length=280)
    tags: list[str] = Field(..., min_length=1, max_length=8)
    category: DeckCategory

    @field_validator("tags")
    @classmethod
    def _normalise_tags(cls, tags: list[str]) -> list[str]:
        """Lowercase, trimmed, de-duplicated, order preserved.

        Tags are a filter key, so "Interview", "interview " and "interview"
        have to be the same key or the filter row fills up with near-duplicates
        that each match a different subset of decks.
        """
        seen: list[str] = []
        for tag in tags:
            cleaned = " ".join(tag.lower().split())[:24]
            if cleaned and cleaned not in seen:
                seen.append(cleaned)
        if not seen:
            raise ValueError("At least one tag is required")
        return seen


class DeckPracticeResponse(BaseModel):
    """Echoes the counter back so the card can update without a refetch."""

    practiceCount: int = Field(alias="practice_count")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)