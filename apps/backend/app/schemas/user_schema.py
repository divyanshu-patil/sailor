from pydantic import BaseModel, ConfigDict, EmailStr
from typing import Literal
from datetime import datetime


class UserProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    name: str | None = None
    occupation: str | None = None
    subscription_tier: str | None = None
    role: str