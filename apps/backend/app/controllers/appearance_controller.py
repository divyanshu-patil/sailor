from app.schemas.appearance_schema import AppearanceOptionResponse


# Hardcoded appearance options - ready to be replaced with DB fetch
DEFAULT_APPEARANCE_OPTIONS = [
 { "id": "ocean", "name": "Ocean", "hex": "#4299E1" },
  { "id": "rust", "name": "Rust", "hex": "#B75C5C" },
  { "id": "sunset", "name": "Sunset", "hex": "#E17F42" },
  { "id": "lavender", "name": "Lavender", "hex": "#8442E1" },
  { "id": "rose", "name": "Rose", "hex": "#E14242" },
  { "id": "midnight", "name": "Midnight", "hex": "#CE42E1" },
  { "id": "forest", "name": "Forest", "hex": "#42E19C" },
]


def get_appearance_options() -> list[AppearanceOptionResponse]:
    """
    Returns list of available appearance options.

    Currently returns hardcoded options.
    To switch to database: fetch from `appearance_options` table in Supabase.
    """
    return [AppearanceOptionResponse(**option) for option in DEFAULT_APPEARANCE_OPTIONS]


# Future implementation - uncomment when DB table exists:
# from app.db.supabase_client import supabase
#
# def get_appearance_options_from_db() -> list[AppearanceOptionResponse]:
#     result = supabase.table("appearance_options").select("*").execute()
#     return [AppearanceOptionResponse(**row) for row in result.data]
