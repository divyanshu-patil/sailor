
from app.models.user_model import User


def get_profile(current_user: User) -> User:
    """
    Returns the current user's profile.
    FastAPI will serialize this through the response_model (UserProfileResponse)
    at the route layer, so no manual dict conversion is needed here.
    """
    return current_user