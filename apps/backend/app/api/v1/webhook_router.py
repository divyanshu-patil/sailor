# from fastapi import APIRouter, Request, HTTPException, Header
# from svix.webhooks import Webhook, WebhookVerificationError
# from app.config.settings import settings
# from app.controllers import webhook_controller

# router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


# @router.post("/clerk", summary="Clerk webhook receiver")
# async def clerk_webhook(
#     request: Request,
#     svix_id: str = Header(None),
#     svix_timestamp: str = Header(None),
#     svix_signature: str = Header(None),
# ):
#     """
#     Receives user lifecycle events from Clerk (created, updated, deleted).
#     Signature is verified via svix — requests with invalid signatures are rejected.

#     To set up:
#     1. Run FastAPI and expose it publicly (e.g. `ngrok http 8000`)
#     2. Clerk Dashboard → Webhooks → Add endpoint → https://<your-url>/webhooks/clerk
#     3. Subscribe to: user.created, user.updated, user.deleted
#     4. Copy the Signing Secret → CLERK_WEBHOOK_SIGNING_SECRET in .env
#     """
#     body = await request.body()

#     wh = Webhook(settings.CLERK_WEBHOOK_SIGNING_SECRET)
#     try:
#         payload = wh.verify(
#             body,
#             {
#                 "svix-id": svix_id,
#                 "svix-timestamp": svix_timestamp,
#                 "svix-signature": svix_signature,
#             },
#         )
#     except WebhookVerificationError:
#         raise HTTPException(status_code=400, detail="Invalid webhook signature.")

#     event_type = payload.get("type")
#     data = payload.get("data", {})

#     if event_type == "user.created":
#         webhook_controller.handle_user_created(data)
#     elif event_type == "user.updated":
#         webhook_controller.handle_user_updated(data)
#     elif event_type == "user.deleted":
#         webhook_controller.handle_user_deleted(data)

#     return {"status": "ok"}