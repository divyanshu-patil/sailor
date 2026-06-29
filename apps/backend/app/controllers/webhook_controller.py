# NOTE: Webhook endpoint exists at POST /webhooks/clerk but is not registered
# with Clerk Dashboard yet. User sync currently relies on the fallback in
# get_current_user() in auth/dependencies.py.
#
# This covers: sign-up, sign-in, all protected routes.
# Not covered: email changes, account deletion from Clerk side.
#
# TODO: Register webhook endpoint once deployed to a public URL
#       1. Deploy FastAPI (Railway / Render / fly.io etc.)
#       2. Clerk Dashboard → Webhooks → Add endpoint → <deployed-url>/webhooks/clerk
#       3. Subscribe to: user.created, user.updated, user.deleted
#       4. Copy signing secret → CLERK_WEBHOOK_SIGNING_SECRET in .env
#       5. Remove the fallback upsert in auth/dependencies.py get_current_user()

from app.db.supabase_client import supabase
import logging

logger = logging.getLogger("uvicorn")


def _extract_primary_email(data: dict) -> str | None:
    return next(
        (
            e["email_address"]
            for e in data.get("email_addresses", [])
            if e["id"] == data.get("primary_email_address_id")
        ),
        None,
    )


def handle_user_created(data: dict) -> None:
    clerk_user_id = data["id"]
    email = _extract_primary_email(data) or ""

    supabase.table("users").upsert(
        {
            "clerk_user_id": clerk_user_id,
            "email": email,
            "role": "user",
        },
        on_conflict="clerk_user_id",
    ).execute()

    logger.info(f"[webhook] user.created → {clerk_user_id} ({email})")


def handle_user_updated(data: dict) -> None:
    clerk_user_id = data["id"]
    email = _extract_primary_email(data)

    if email:
        supabase.table("users").update({"email": email}).eq(
            "clerk_user_id", clerk_user_id
        ).execute()

    logger.info(f"[webhook] user.updated → {clerk_user_id}")


def handle_user_deleted(data: dict) -> None:
    clerk_user_id = data["id"]
    supabase.table("users").delete().eq("clerk_user_id", clerk_user_id).execute()
    logger.info(f"[webhook] user.deleted → {clerk_user_id}")