from pydantic import model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    CLERK_JWT_PUBLIC_KEY: str
    CLERK_SECRET_KEY: str
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str
    DATABASE_URL: str
    CLERK_WEBHOOK_SIGNING_SECRET: str

    # Shared secret for the daily-practice admin regeneration route. Empty by
    # default, and an empty value DISABLES the route rather than leaving it open
    # — a deployment that forgot to set it must not end up with an unguarded
    # endpoint that rebuilds content on demand.
    DAILY_PRACTICE_ADMIN_SECRET: str = ""

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
    # "openai", "gemini", or "openrouter". The prompts and the pipeline are
    # provider-neutral; only the adapter under services/ai/providers/ differs.
    # Also the fallback when AI_USE_OPENROUTER is on — see below.
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

    # Seconds a single model call may take before it is abandoned.
    #
    # The script's beats run concurrently, so wall-clock time is the *slowest*
    # call, not the average — one straggler sets the user's wait. Measured on
    # ollama cloud: a healthy beat call is 2-50s, but a call that has gone wrong
    # can sit open for minutes before the provider admits it (one measured run
    # hung for 170s and then returned a 500). Cutting it loose hands the work to
    # the fallback model, which answers in seconds.
    AI_REQUEST_TIMEOUT: float = 90.0

    # ---- database pool ---------------------------------------------------
    # FastAPI runs these sync sessions on its threadpool (40 threads by
    # default), so a pool of 5 + 10 overflow was the ceiling on concurrent
    # requests long before Postgres was. Sized per process: API workers and
    # Celery workers each get their own, so keep
    # (processes x (POOL_SIZE + MAX_OVERFLOW)) under the pooler's limit.
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    # Fail fast rather than piling up requests behind an exhausted pool.
    DB_POOL_TIMEOUT: int = 10

    # ---- Celery ----------------------------------------------------------
    # Concurrency is per worker process. The CLI flag still wins, so a
    # per-queue worker can be given its own value without touching this.
    CELERY_WORKER_CONCURRENCY: int = 2
    # Task results live in Redis and are never read by this app — the status
    # endpoints answer from the generation row and its own status key. Without
    # an expiry they accumulate forever.
    CELERY_RESULT_EXPIRES: int = 3600
    # Recycled after this many tasks, which bounds the memory a long-lived
    # worker can leak through an SDK or a parser.
    CELERY_MAX_TASKS_PER_CHILD: int = 200

    # ---- subscription quota ----------------------------------------------
    # Server-side secret key from the RevenueCat dashboard (Project settings ->
    # API keys -> Secret). Distinct from the public SDK keys the app ships with;
    # this one reads any subscriber's entitlements, so it never leaves here.
    #
    # Left empty, quota still enforces — it just trusts the tier already on the
    # user row instead of confirming it, which is what makes local development
    # and the test suite work without a RevenueCat account.
    REVENUECAT_API_KEY: str = ""
    # Must match PRO_ENTITLEMENT in the mobile app's lib/purchases.ts.
    REVENUECAT_ENTITLEMENT_ID: str = "pro"

    # Generations per rolling 30 days. Tuned from the dashboard side of the
    # business, not the code, which is why they're env vars rather than
    # constants — pricing changes shouldn't need a deploy.
    # -1 means unlimited: the counter still moves, so usage stays visible, but
    # no request is ever refused for having spent it. Generation is not what we
    # charge for — set either of these to a positive number and the cap comes
    # straight back on, with no code change.
    FREE_MONTHLY_GENERATIONS: int = -1
    PRO_MONTHLY_GENERATIONS: int = -1

    # ---- OpenRouter (free tier) ------------------------------------------
    # A switch rather than another AI_PROVIDER value, because OpenRouter is not
    # an alternative to the configured provider here — it sits *in front* of it.
    # On, every call tries OpenRouter's free models first and falls through to
    # AI_PROVIDER the moment the free budget is spent; off, nothing about the
    # existing path changes. One flag also means the fallback stays configured
    # and warm rather than needing an env edit and a restart at the exact moment
    # the free tier runs out.
    #
    # On by default: the free tier costs nothing and the fallback catches
    # everything it can't serve. Without OPENROUTER_API_KEY set it is skipped
    # anyway, so an install that never heard of OpenRouter is unaffected.
    AI_USE_OPENROUTER: bool = True
    OPENROUTER_API_KEY: str = ""
    # Free ids only — the adapter drops anything without the ':free' suffix, so
    # a typo costs nothing instead of quietly billing. The primary must be
    # vision-capable: briefs can carry reference images.
    OPENROUTER_MODEL: str = "google/gemma-4-31b-it:free"
    OPENROUTER_FALLBACK_MODEL: str = "google/gemma-4-26b-a4b-it:free"
    # How long OpenRouter is skipped entirely after it rate-limits, when it
    # doesn't tell us itself. Re-asking a spent free budget on every call just
    # adds a round trip to every generation, so the first 429 parks it and the
    # configured provider takes over until the window is up.
    OPENROUTER_COOLDOWN_SECONDS: float = 600.0

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