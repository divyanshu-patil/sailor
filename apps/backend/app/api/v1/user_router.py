from fastapi import APIRouter, Depends

from app.controllers import user_controller
from app.auth.dependencies import get_current_user
from app.models.user_model import User
from app.schemas.user_schema import UserProfileResponse  # adjust path to match your project

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/health")
def get_user_health_check():
    """Simple health check for users — no auth required."""
    return {"status": "ok", "service": "user-router"}


@router.get(
    "/profile",
    response_model=UserProfileResponse,
    summary="Get my profile",
    description="Returns the authenticated user's profile from the users table.",
)
def get_my_profile(current_user: User = Depends(get_current_user)):
    return user_controller.get_profile(current_user)