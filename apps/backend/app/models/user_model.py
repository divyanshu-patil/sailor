from typing import TypedDict


class UserRecord(TypedDict):
    """Matches the columns of the `users` table in Supabase."""
    id: str
    clerk_user_id: str
    email: str
    role: str           # "user" | "admin"
    created_at: str
    updated_at: str