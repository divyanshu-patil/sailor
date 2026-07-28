from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    CLERK_JWT_PUBLIC_KEY: str
    CLERK_SECRET_KEY: str
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str
    DATABASE_URL: str
    CLERK_WEBHOOK_SIGNING_SECRET: str

    REDIS_URL: str
    CELERY_BROKER_URL: str
    CELERY_RESULT_BACKEND: str
    OLLAMA_API_KEY: str
    OLLAMA_MODEL: str
    OLLAMA_FALLBACK_MODEL: str

    # The configured models are reasoning models, and a script is a dozen-odd
    # separate calls — so the thinking budget is paid a dozen times over and
    # dominates the wall clock. The beats are heavily prompt-constrained (fixed
    # skeleton, per-beat role, explicit word target), which is most of what the
    # reasoning pass would otherwise be working out, so turning it off buys back
    # the bulk of the generation time for very little quality. Flip to true in
    # .env to compare.
    OLLAMA_THINK: bool = False

    # How many AI calls a single generation may have in flight at once. The
    # script fans out to one call per beat and cards fan out to one per batch;
    # this is what keeps that fan-out from tripping the provider's rate limit.
    # Lower it if you start seeing 429s.
    OLLAMA_MAX_CONCURRENCY: int = 8

    class Config:
        env_file = ".env"


# Single instance used everywhere — import this, not Settings()
settings = Settings()