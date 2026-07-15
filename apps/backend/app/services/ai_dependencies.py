from app.services.deck_generation_service import DeckGenerationService

def get_deck_generation_service() -> DeckGenerationService:
    return DeckGenerationService()