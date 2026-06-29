from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    CLERK_JWT_PUBLIC_KEY: str
    CLERK_SECRET_KEY: str
    # NOTE: Webhook endpoint exists at POST /webhooks/clerk but is not registered
    # with Clerk Dashboard yet. User sync currently relies on the fallback in
    # get_current_user() — on first authenticated request, if the user row doesn't
    # exist in Supabase it gets auto-created from the JWT claims.
    
    # This covers: sign-up, sign-in, all protected routes.
    # Not covered: email changes, account deletion from Clerk side.

    # TODO: Uncomment this when we implement webhook verification 
    # CLERK_WEBHOOK_SIGNING_SECRET: str 
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str

    class Config:
        env_file = ".env"


# Single instance used everywhere — import this, not Settings()
settings = Settings()