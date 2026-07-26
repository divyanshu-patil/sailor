# app/schemas/card_schema.py
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.utils.enums.speaking_style import SpeakingStyle


class CardCreateParams(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1)
    keywords: list[str] = Field(default_factory=list, max_length=10)
    impact: float = Field(ge=0, le=1)
    delivery: SpeakingStyle


class CardUpdateParams(BaseModel):
    expected_version: int

    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, min_length=1)
    keywords: Optional[list[str]] = Field(default=None, max_length=10)
    impact: Optional[float] = Field(default=None, ge=0, le=1)
    delivery: Optional[SpeakingStyle] = None


class CardResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    deck_id: int
    position: int
    title: str
    description: str
    keywords: list[str]
    color: str
    impact: float  # Decimal on the model, cast to float here for a plain JSON number
    delivery: SpeakingStyle
    version: int
    created_at: datetime
    updated_at: datetime


class CardGenerationStatusResponse(BaseModel):
    deck_id: int
    card_count: int
    cards_generation_status: str
    cards_generation_error: Optional[str] = None