from typing import Optional
from pydantic import BaseModel


class UserPreferencesResponse(BaseModel):
    practiceRemindersEnabled: bool
    practiceReminderTime: str
    defaultMood: str


class UserPreferencesUpdate(BaseModel):
    practiceRemindersEnabled: Optional[bool] = None
    practiceReminderTime: Optional[str] = None
    defaultMood: Optional[str] = None


class UserPreferencesCreate(BaseModel):
    practiceRemindersEnabled: bool = True
    practiceReminderTime: str = "09:00"
    defaultMood: str = "confident"
