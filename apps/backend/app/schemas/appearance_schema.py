from pydantic import BaseModel


class AppearanceOptionResponse(BaseModel):
    """Shape of appearance options returned to the client."""
    id: str
    name: str
    hex: str

    class Config:
        from_attributes = True
