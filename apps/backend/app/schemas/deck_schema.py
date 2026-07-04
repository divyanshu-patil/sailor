from pydantic import BaseModel, ConfigDict, Field
from typing import List, Literal
from datetime import datetime

from app.utils.enums.speaking_style import SpeakingStyle


class AttachmentRequest(BaseModel):
    id: str
    type: Literal["pdf", "image", "link", "document"]
    name: str
    uri: str


class DeckGenerateRequest(BaseModel):
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


class CardResponse(BaseModel):
    id: int
    position: int
    title: str
    description: str
    color: str
    impact: float
    delivery: SpeakingStyle
    
    model_config = ConfigDict(from_attributes=True)


class DeckGenerateResponse(BaseModel):
    id: int
    title: str
    color: str
    duration_mins: int = Field(..., serialization_alias="durationMinutes")

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