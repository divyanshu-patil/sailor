from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, computed_field

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
    #: Set once, by the last step of each flow. Never unset by the client —
    #: there is no "un-onboard" the app can ask for.
    onboarding_completed: Optional[bool] = None
    profile_setup_completed: Optional[bool] = None
    subscription_tier: SubscriptionTier
    role: UserRole
    monthly_generations_used: int
    #: Whether this ACCOUNT has been through onboarding and the profile wizard.
    #: The client routes off these, so a reinstall or a second device picks up
    #: where the account left off instead of starting over.
    onboarding_completed: bool = False
    profile_setup_completed: bool = False
    created_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def monthly_generation_limit(self) -> int:
        """Derived rather than stored: a limit column would be a second copy of
        a number the tier already determines, free to drift the moment pricing
        changes. Paired with monthly_generations_used above, this is everything
        the app needs to show "2 of 3 left" without a second endpoint."""
        from app.services.quota import limit_for

        return limit_for(self.subscription_tier)

class UserProfileUpdateRequest(BaseModel):
    """All fields optional — PATCH is a partial update."""
    full_name: Optional[str] = Field(default=None, max_length=100)
    nickname: Optional[str] = Field(default=None, max_length=30)
    experience_level: Optional[ExperienceLevel] = None
    profession: Optional[Profession] = None
    #: Set once, by the last step of each flow. Never unset by the client —
    #: there is no "un-onboard" the app can ask for.
    onboarding_completed: Optional[bool] = None
    profile_setup_completed: Optional[bool] = None