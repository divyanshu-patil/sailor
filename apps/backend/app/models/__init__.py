from .user_model import User
from .onboarding_model import OnboardingProgress
from .deck_model import Deck
from .card_model import Card
from .script_model import ScriptGeneration, ScriptVersion
from .attachment_model import Attachment
from .daily_model import DailyContent

# Imported for their side effect — registering each table on Base.metadata —
# and re-exported so `from app.models import Deck` works.
__all__ = [
    "Attachment",
    "Card",
    "DailyContent",
    "Deck",
    "OnboardingProgress",
    "ScriptGeneration",
    "ScriptVersion",
    "User",
]
