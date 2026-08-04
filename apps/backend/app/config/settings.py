from pydantic import model_validator
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

    MINIO_ROOT_USER: str
    MINIO_ROOT_PASSWORD: str
    MINIO_PORT: int

    # Host:port a *client device* can reach MinIO on, used only for signing
    # presigned URLs — e.g. "192.168.1.42:9000" on a LAN, or "media.example.com"
    # behind a proxy. Left empty, URLs are signed for localhost, which a
    # simulator can reach and a physical phone cannot.
    MINIO_PUBLIC_ENDPOINT: str = ""
    MINIO_PUBLIC_SECURE: bool = False

    # ---- AI provider -----------------------------------------------------
    # Which service generates scripts and cards: "ollama", "anthropic",
    # "openai", or "gemini". The prompts and the pipeline are provider-neutral;
    # only the adapter under services/ai/providers/ differs.
    AI_PROVIDER: str = "ollama"
    AI_MODEL: str = ""
    AI_FALLBACK_MODEL: str = ""

    # "Answer, don't deliberate."
    #
    # Every call this app makes is heavily prompt-constrained — a fixed script
    # skeleton, a per-beat role, an explicit word target, a JSON shape — so a
    # reasoning pass mostly re-derives what the prompt already states, on the
    # user's clock, once per call across a dozen-odd calls. Each adapter maps
    # this onto its provider's own knob (Ollama `think`, Anthropic/OpenAI
    # effort). Set false to compare quality.
    AI_FAST: bool = True

    # How many AI calls a single generation may have in flight at once. The
    # script fans out to one call per beat and cards to one per batch; this is
    # what keeps that fan-out from tripping the provider's rate limit. Lower it
    # if you start seeing 429s.
    AI_MAX_CONCURRENCY: int = 12

    # ---- per-provider credentials ---------------------------------------
    OLLAMA_API_KEY: str = ""
    OLLAMA_HOST: str = ""
    ANTHROPIC_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    # Point at any OpenAI-compatible endpoint (Groq, Together, OpenRouter, a
    # local server) without needing a separate adapter.
    OPENAI_BASE_URL: str = ""

    # Superseded by AI_MODEL / AI_FALLBACK_MODEL. Kept so an existing .env keeps
    # working — see the validator below, which promotes them when the new keys
    # aren't set.
    OLLAMA_MODEL: str = ""
    OLLAMA_FALLBACK_MODEL: str = ""

    @model_validator(mode="after")
    def _adopt_legacy_ollama_model_vars(self) -> "Settings":
        if not self.AI_MODEL and self.OLLAMA_MODEL:
            self.AI_MODEL = self.OLLAMA_MODEL
        if not self.AI_FALLBACK_MODEL and self.OLLAMA_FALLBACK_MODEL:
            self.AI_FALLBACK_MODEL = self.OLLAMA_FALLBACK_MODEL
        return self

    class Config:
        env_file = ".env"
        extra = "ignore"


# Single instance used everywhere — import this, not Settings()
settings = Settings()