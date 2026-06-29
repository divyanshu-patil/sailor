from pydantic import BaseModel, EmailStr
from typing import Literal
from datetime import datetime


class UserProfileResponse(BaseModel):
    """Shape of the response for GET /profile"""
    id: str
    clerk_user_id: str
    email: str
    role: Literal["user", "admin"]
    created_at: datetime

    class Config:
        from_attributes = True
