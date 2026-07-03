from unittest.mock import Base

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.middlewares.logging_middleware import LoggingMiddleware
from app.api.v1 import user_router
from app.db.database import engine
from app.db.base import Base

# Models
from app.models.user_model import User
from app.models.deck_model import Deck
from app.models.card_model import Card
from app.api.v1 import deck_router

Base.metadata.create_all(bind=engine)

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
app.include_router(deck_router.router, prefix="/api/v1")

# TODO: Uncomment this when we implement webhook verification
# app.include_router(webhook_router.router)   # no /api/v1 prefix — webhooks are external


@app.get("/health", tags=["Health"])
def health_check():
    """Simple health check — no auth required."""
    return {"status": "ok", "service": "your-app-api"}