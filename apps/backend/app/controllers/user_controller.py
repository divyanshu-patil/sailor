from sqlalchemy.orm import Session

def get_profile(current_user: dict) -> dict:
    """
    Returns the authenticated user's profile.
    current_user already comes from the DB (via get_current_user dependency),
    so this is just a pass-through — no extra DB call needed.
    """
    return current_user
