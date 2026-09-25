from fastapi import APIRouter, status
from app.schemas.appearance_schema import AppearanceOptionResponse
from app.controllers import appearance_controller

router = APIRouter(tags=["Appearance"])


@router.get(
    "/options",
    response_model=list[AppearanceOptionResponse],
    summary="Get appearance options",
    description="Returns list of available appearance/accent color options.",
    status_code=status.HTTP_200_OK,
)
def get_options() -> list[AppearanceOptionResponse]:
    """
    Public route. No auth required.

    Returns predefined appearance options (accent colors).
    Ready to be connected to a database table if needed.
    """
    return appearance_controller.get_appearance_options()
