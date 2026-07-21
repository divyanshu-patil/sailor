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

    class Config:
        env_file = ".env"


# Single instance used everywhere — import this, not Settings()
settings = Settings()