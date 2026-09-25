from sqlalchemy.orm import Session
from sqlalchemy import select
from fastapi import HTTPException

from app.models.preferences_model import UserPreferences
from app.schemas.preferences_schema import (
    UserPreferencesResponse,
    UserPreferencesUpdate,
    UserPreferencesCreate,
)


def get_user_preferences(db: Session, user_id: int) -> UserPreferencesResponse:
    """Fetch preferences for a user from the database."""
    statement = select(UserPreferences).where(UserPreferences.user_id == user_id)
    prefs = db.execute(statement).scalars().first()

    if not prefs:
        return UserPreferencesResponse(
            practiceRemindersEnabled=False,
            practiceReminderTime="09:00",
            defaultMood="confident",
        )

    return UserPreferencesResponse(
        practiceRemindersEnabled=prefs.practice_reminders_enabled,
        practiceReminderTime=prefs.practice_reminder_time,
        defaultMood=prefs.default_mood,
    )


def create_user_preferences(
    db: Session,
    user_id: int,
    initial: UserPreferencesCreate,
) -> UserPreferencesResponse:
    """Create the preferences row for a user. Raises if one already exists."""
    statement = select(UserPreferences).where(UserPreferences.user_id == user_id)
    existing = db.execute(statement).scalars().first()

    if existing:
        raise HTTPException(status_code=409, detail="Preferences already exist for this user")

    prefs = UserPreferences(
        user_id=user_id,
        practice_reminders_enabled=initial.practiceRemindersEnabled,
        practice_reminder_time=initial.practiceReminderTime,
        default_mood=initial.defaultMood,
    )
    db.add(prefs)
    db.commit()
    db.refresh(prefs)

    return UserPreferencesResponse(
        practiceRemindersEnabled=prefs.practice_reminders_enabled,
        practiceReminderTime=prefs.practice_reminder_time,
        defaultMood=prefs.default_mood,
    )


def update_user_preferences(
    db: Session,
    user_id: int,
    updates: UserPreferencesUpdate,
) -> UserPreferencesResponse:
    """Update preferences for a user in the database."""
    statement = select(UserPreferences).where(UserPreferences.user_id == user_id)
    prefs = db.execute(statement).scalars().first()

    if not prefs:
        # Create new preferences
        prefs = UserPreferences(
            user_id=user_id,
            practice_reminders_enabled=(
                updates.practiceRemindersEnabled
                if updates.practiceRemindersEnabled is not None
                else False
            ),
            practice_reminder_time=(
                updates.practiceReminderTime
                if updates.practiceReminderTime is not None
                else "09:00"
            ),
            default_mood=(
                updates.defaultMood if updates.defaultMood is not None else "confident"
            ),
        )
        db.add(prefs)
    else:
        # Update existing
        if updates.practiceRemindersEnabled is not None:
            prefs.practice_reminders_enabled = updates.practiceRemindersEnabled
        if updates.practiceReminderTime is not None:
            prefs.practice_reminder_time = updates.practiceReminderTime
        if updates.defaultMood is not None:
            prefs.default_mood = updates.defaultMood

    db.commit()
    db.refresh(prefs)

    return UserPreferencesResponse(
        practiceRemindersEnabled=prefs.practice_reminders_enabled,
        practiceReminderTime=prefs.practice_reminder_time,
        defaultMood=prefs.default_mood,
    )
