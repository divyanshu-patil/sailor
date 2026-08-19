import logging

from app.config.settings import settings
from app.services.ai.providers.base import (
    ChatRequest,
    ProviderError,
    RateLimitedError,
)
from app.services.ai.providers.openai_provider import OpenAIProvider

logger = logging.getLogger("celery")

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

# OpenRouter marks its no-cost variants with this suffix on the model id, and
# it is the only thing that distinguishes them from the paid one of the same
# model. Anything without it can be billed, so the adapter refuses to send it —
# a typo in OPENROUTER_MODEL should cost nothing, not silently start spending.
FREE_SUFFIX = ":free"

# The account has no credit left. Not a failure of this call — the same request
# will work once the budget resets — so it's treated like a 429: back off this
# provider and let the fallback answer.
PAYMENT_REQUIRED = 402

# Ids already complained about. models() is called several times per generation
# (the logger asks, then the chat loop asks), and a misconfigured id is one
# mistake, not one per call.
_warned: set[str] = set()


class OpenRouterProvider(OpenAIProvider):
    """
    OpenRouter, restricted to its free models.

    It speaks the OpenAI chat-completions API, so everything the pipeline needs
    — the system/user shape, images as base64 data URLs on the final user turn —
    is already handled by OpenAIProvider; only the endpoint, the key, and the
    model list differ. (Documents never reach a provider at all: attachments are
    extracted to text server-side before the prompt is built.)
    """

    name = "openrouter"

    # OpenRouter's schema is the pre-rename one. Confirmed against
    # /api/v1/models: every free model lists `max_tokens` in
    # supported_parameters and none list `max_completion_tokens`.
    max_tokens_param = "max_tokens"

    def models(self) -> list[str]:
        wanted = [
            m.strip()
            for m in (settings.OPENROUTER_MODEL, settings.OPENROUTER_FALLBACK_MODEL)
            if m.strip()
        ]
        free = [m for m in wanted if m.endswith(FREE_SUFFIX)]
        for paid in (m for m in wanted if m not in free and m not in _warned):
            _warned.add(paid)
            logger.warning(
                f"[ai] ignoring OpenRouter model '{paid}' — not a '{FREE_SUFFIX}' id. "
                f"Free ids look like 'vendor/model{FREE_SUFFIX}' — "
                f"see openrouter.ai/models?q=free"
            )
        return free

    def _credentials(self) -> tuple[str, str]:
        return settings.OPENROUTER_API_KEY, OPENROUTER_BASE_URL

    def complete(self, request: ChatRequest, model: str) -> str:
        try:
            return super().complete(request, model)
        except ProviderError as e:
            if getattr(e, "status_code", None) == PAYMENT_REQUIRED:
                raise RateLimitedError(f"'{model}' free budget exhausted: {e}") from e
            raise
