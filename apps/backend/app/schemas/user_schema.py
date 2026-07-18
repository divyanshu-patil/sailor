from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.user_model import ExperienceLevel, Profession, SubscriptionTier, UserRole


class UserProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    clerk_user_id: str
    email: EmailStr
    full_name: Optional[str] = None
    nickname: Optional[str] = None
    experience_level: Optional[ExperienceLevel] = None
    profession: Optional[Profession] = None
    subscription_tier: SubscriptionTier
    role: UserRole
    monthly_generations_used: int
    created_at: datetime
    updated_at: datetime