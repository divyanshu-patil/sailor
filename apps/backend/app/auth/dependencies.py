from fastapi import Depends, HTTPException, status
from app.auth.clerk import get_current_clerk_user, ClerkUser
from app.db.supabase_client import supabase

# TODO: Register webhook endpoint once deployed to a public URL
#       Steps:
#       1. Deploy FastAPI (Railway / Render / fly.io etc.)
#       2. Clerk Dashboard → Webhooks → Add endpoint → <deployed-url>/webhooks/clerk
#       3. Subscribe to: user.created, user.updated, user.deleted
#       4. Copy signing secret → CLERK_WEBHOOK_SIGNING_SECRET in env
#       5. Uncomment CLERK_WEBHOOK_SIGNING_SECRET in settings.py
#       6. Remove the fallback upsert in get_current_user() if desired

def get_current_user(
    clerk_user: ClerkUser = Depends(get_current_clerk_user),
) -> dict:
    """
    Resolves the authenticated Clerk user to your own `users` table row.

    - First tries to find an existing user by clerk_user_id
    - If not found (race condition before webhook fires), creates one on the fly
    - Returns the full user dict from Supabase

    This is the dependency to use on most protected routes.
    """
    try:
        result = (
            supabase.table("users")
            .select("*")
            .eq("clerk_user_id", clerk_user.clerk_user_id)
            .execute()
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Supabase error: {str(e)}",
        )

    # result.data is a list — grab first row if exists
    if result.data and len(result.data) > 0:
        return result.data[0]

    # fallback — create user if not found
    try:
        new_user = (
            supabase.table("users")
            .insert({
                "clerk_user_id": clerk_user.clerk_user_id,
                "email": clerk_user.email or "",
                "role": "user",
            })
            .execute()
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Supabase insert error: {str(e)}",
        )

    if not new_user.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user record.",
        )

    return new_user.data[0]


def require_admin(
    current_user: dict = Depends(get_current_user),
) -> dict:
    """
    Extends get_current_user — additionally checks that the user has role='admin'.
    Raises 403 if not. Use on admin-only routes.

    Usage:
        @router.get("/admin/something")
        def admin_route(user: dict = Depends(require_admin)):
            ...
    """
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )
    return current_user