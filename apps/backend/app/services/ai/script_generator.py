import logging

from ollama import ResponseError

from app.config.settings import settings
from app.services.ai.ollama_client import get_ollama_client
from app.services.ai.prompts import build_script_prompt
from app.utils.enums.deck_enums import AudienceType

logger = logging.getLogger("celery")


class ScriptGenerationError(Exception):
    """Raised when no configured model could produce a script."""


def generate_script(title: str, description: str | None, duration_mins: int, audience: AudienceType) -> str:
    client = get_ollama_client()
    messages = build_script_prompt(title, description, duration_mins, audience)

    models_to_try = [m for m in (settings.OLLAMA_MODEL, settings.OLLAMA_FALLBACK_MODEL) if m]
    last_error: Exception | None = None

    for model in models_to_try:
        try:
            response = client.chat(model=model, messages=messages, stream=False)
            content = (response.get("message", {}) or {}).get("content", "").strip()
            if not content:
                raise ScriptGenerationError(f"Model '{model}' returned empty content")
            return content
        except ResponseError as e:
            logger.warning(f"[ai] '{model}' failed ({e.status_code}): {e.error}")
            last_error = e
        except Exception as e:  # network errors, timeouts, etc.
            logger.warning(f"[ai] '{model}' failed: {e}")
            last_error = e

    raise ScriptGenerationError(f"All models failed. Last error: {last_error}")