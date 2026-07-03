from fastapi import APIRouter, Depends
# from app.auth.dependencies import get_current_user
from app.schemas.user_schema import UserProfileResponse
from app.controllers import user_controller

router = APIRouter(prefix="/users", tags=["Users"])


# # Current user's own profile
# @router.get(
#     "/profile",
#     response_model=UserProfileResponse,
#     summary="Get my profile",
#     description="Returns the authenticated user's profile from the users table.",
# )
# def get_my_profile(
#     current_user: dict = Depends(get_current_user),
# ):
#     """
#     Protected route. Requires a valid Clerk JWT.

#     Flow:
#       1. Bearer token extracted from Authorization header
#       2. JWT verified against Clerk's public key (auth/clerk.py)
#       3. clerk_user_id looked up in Supabase users table (auth/dependencies.py)
#       4. Full user dict returned here → serialized via UserProfileResponse
#     """
#     return user_controller.get_profile(current_user)
