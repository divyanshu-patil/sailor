from unittest.mock import Base

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.middlewares.logging_middleware import LoggingMiddleware
from app.api.v1 import user_router, appearance_router
from app.api.v1 import webhook_router
from app.db.database import engine
from app.db.base import Base
from app.api.v1 import deck_router, preferences_router
from app.api.v1 import card_router, script_router

import app.models
from app.models.preferences_model import UserPreferences

# NO create_all() here — Alembic owns the schema.
#
# This used to call `Base.metadata.create_all(bind=engine)`, which silently
# created any table missing from the database straight off the models, without
# recording anything in alembic_version. The result was a database whose tables
# matched the models while its migration pointer sat several revisions behind:
# `script_generations` existed, `alembic_version` said it didn't, and the next
# migration to add a column to it never ran — so the app crashed on a column the
# model said was there. create_all also only ever creates; it never adds a column
# to a table that already exists, so it cannot keep up with the models anyway.
#
# Schema changes go through `alembic revision` + `alembic upgrade head`.

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
app.include_router(appearance_router.router, prefix="/api/v1/appearance")
app.include_router(deck_router.router, prefix="/api/v1")
app.include_router(preferences_router.router, prefix="/api/v1/users")
app.include_router(card_router.router, prefix="/api/v1")
app.include_router(script_router.router, prefix="/api/v1")
app.include_router(webhook_router.router)

# TODO: Uncomment this when we implement webhook verification
# app.include_router(webhook_router.router)   # no /api/v1 prefix — webhooks are external


@app.get("/health", tags=["Health"])
def health_check():
    """Simple health check — no auth required."""
    return {"status": "ok", "service": "your-app-api"}