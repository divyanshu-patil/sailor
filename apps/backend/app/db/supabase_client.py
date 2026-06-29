from supabase import create_client, Client
from app.config.settings import settings

# Service role client — has full DB access, bypasses RLS
supabase: Client = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_SERVICE_ROLE_KEY,
)