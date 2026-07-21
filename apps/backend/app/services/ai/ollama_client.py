from ollama import Client

from app.config.settings import settings

OLLAMA_CLOUD_HOST = "https://ollama.com"


def get_ollama_client() -> Client:
    return Client(
        host=OLLAMA_CLOUD_HOST,
        headers={"Authorization": f"Bearer {settings.OLLAMA_API_KEY}"},
    )