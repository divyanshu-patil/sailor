from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db.supabase_client import supabase
from app.middlewares.logging_middleware import LoggingMiddleware
from app.api.v1 import user_router

app = FastAPI(
    title="Your App API",
    description="FastAPI backend with Clerk auth + Supabase",
    version="1.0.0",
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
# In production: replace ["*"] with your actual Expo/web app origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Custom middlewares ────────────────────────────────────────────────────────
app.add_middleware(LoggingMiddleware)

# ─── Routers ──────────────────────────────────────────────────────────────────
# All routes are prefixed with /api/v1 for versioning
app.include_router(user_router.router, prefix="/api/v1")

# TODO: Uncomment this when we implement webhook verification
# app.include_router(webhook_router.router)   # no /api/v1 prefix — webhooks are external


@app.get("/health", tags=["Health"])
def health_check():
    """Simple health check — no auth required."""
    return {"status": "ok", "service": "your-app-api"}

# add temporarily in app/main.py
@app.get("/debug/supabase")
def debug_supabase():
    try:
        result = supabase.table("users").select("*").execute()
        return {"data": result.data, "count": len(result.data)}
    except Exception as e:
        return {"error": str(e)}