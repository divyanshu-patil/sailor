from app.config.settings import settings
from app.services.ai.providers.openai_provider import OpenAIProvider

GROQ_BASE_URL = "https://api.groq.com/openai/v1"


class GroqProvider(OpenAIProvider):
    """
    Groq.

    It serves the OpenAI chat-completions API at its own endpoint, so
    everything the pipeline needs is already in OpenAIProvider: the
    system/user shape, images as base64 data URLs on the final user turn, the
    429 handling and the retry-after parsing. Only the endpoint and the key
    differ — which is exactly the case `_credentials` exists for.

    It reads AI_MODEL / AI_FALLBACK_MODEL like every other *selected* provider
    (OpenRouter is the exception because it sits in front of the selected one
    rather than being it), so switching to Groq is two env vars:

        AI_PROVIDER=groq
        GROQ_API_KEY=gsk_...
        AI_MODEL=llama-3.3-70b-versatile

    The `fast` flag is a no-op here. It maps to `reasoning_effort`, which the
    inherited code only sends to models matched by OpenAI's own naming, and no
    Groq id matches those — which is the right outcome either way: the reason
    to reach for Groq is that it is already fast.
    """

    name = "groq"

    # Groq's schema is the pre-rename one: `max_tokens`, not
    # `max_completion_tokens`. It accepts both today but documents the former,
    # and an unknown parameter here is a 400 rather than a silent drop.
    max_tokens_param = "max_tokens"

    def _credentials(self) -> tuple[str, str]:
        return settings.GROQ_API_KEY, GROQ_BASE_URL
