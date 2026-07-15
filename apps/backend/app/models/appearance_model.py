from typing import TypedDict


class AppearanceOptionRecord(TypedDict):
    """Matches the columns of the `appearance_options` table in Supabase."""
    id: str
    name: str
    hex: str