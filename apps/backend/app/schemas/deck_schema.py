
from pydantic import BaseModel, ConfigDict, Field
from typing import List, Literal
from datetime import datetime
from typing import Optional

from app.utils.enums.speaking_style import SpeakingStyle
from app.utils.enums.deck_enums import GenerationStatus


class AttachmentRequest(BaseModel):
    id: str
    type: Literal["pdf", "image", "link", "document"]
    name: str
    uri: str


class DeckCreateRequest(BaseModel):
    description: str = Field(
        ...,
        min_length=1,
        description="Presentation topic or prompt",
    )

    duration_minutes: int = Field(
        ...,
        alias="durationMinutes",
        ge=1,
        le=60,
        description="Desired presentation duration in minutes",
    )

    audience_index: int = Field(
        ...,
        alias="audienceIndex",
        ge=0,
        description="Selected audience level/index from the frontend",
    )

    card_count: int = Field(
        ...,
        alias="cardCount",
        ge=1,
        le=100,
        description="Number of cards to generate",
    )

    attachments: List[AttachmentRequest] = []

class DeckResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    title: str
    script: Optional[str] = None
    color: str
    duration_mins: int
    card_count: int
    is_favorite: bool
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
    id: int
    title: str
    description: str
    color: str
    updatedAt: datetime
    slideCount: int
    durationMins: int
    isFavourite: bool