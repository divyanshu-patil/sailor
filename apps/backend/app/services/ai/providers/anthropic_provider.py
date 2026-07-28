import logging

from app.config.settings import settings
from app.services.ai.providers.base import (
    ChatRequest,
    ProviderError,
    RateLimitedError,
)

logger = logging.getLogger("celery")


class AnthropicProvider:
    """
    Claude, via the official `anthropic` SDK.

    Two things differ from the other adapters and both are deliberate:

    - The system prompt is a top-level parameter, not a message. That's the
      Messages API shape, and it's why ChatRequest keeps `system` separate.
    - `fast` maps to the `effort` parameter rather than to disabling thinking.
      On current Claude models thinking is on by default, and turning it off has
      two documented failure modes — internal tags leaking into the visible
      response, and tool calls being written as plain text. Lowering effort gets
      the same latency and cost saving without either, which is Anthropic's own
      recommendation.

    Sampling parameters (temperature/top_p/top_k) are deliberately not sent:
    current Claude models reject them with a 400.
    """

    name = "anthropic"

    def models(self) -> list[str]:
        return [m for m in (settings.AI_MODEL, settings.AI_FALLBACK_MODEL) if m]

    def _client(self):
        try:
            from anthropic import Anthropic
        except ImportError as e:  # pragma: no cover - depends on install extras
            raise ProviderError(
                "AI_PROVIDER=anthropic requires the `anthropic` package. "
                "Install it with `uv add anthropic`."
            ) from e

        # A bare constructor also picks up ANTHROPIC_API_KEY or an `ant auth
        # login` profile, so an unset setting is not necessarily an error.
        return Anthropic(api_key=settings.ANTHROPIC_API_KEY or None)

    def complete(self, request: ChatRequest, model: str) -> str:
        import anthropic

        try:
            response = self._client().messages.create(
                model=model,
                max_tokens=request.max_tokens,
                system=request.system,
                messages=request.messages,
                output_config={"effort": "low" if request.fast else "high"},
            )
        except anthropic.RateLimitError as e:
            # Transient and account-scoped — wait rather than falling through to
            # a fallback drawing on the same budget.
            raise RateLimitedError(f"'{model}' rate limited: {e}") from e
        except anthropic.APIStatusError as e:
            raise ProviderError(f"'{model}' failed ({e.status_code}): {e.message}") from e
        except anthropic.APIConnectionError as e:
            raise ProviderError(f"'{model}' unreachable: {e}") from e
        except Exception as e:
            raise ProviderError(f"'{model}' failed: {e}") from e

        # Safety classifiers can decline a request; that arrives as a normal 200
        # with an empty content list, so reading content[0] blind would crash.
        if response.stop_reason == "refusal":
            raise ProviderError(f"'{model}' declined the request")

        text = "".join(
            block.text for block in response.content if getattr(block, "type", None) == "text"
        ).strip()
        if not text:
            raise ProviderError(f"Model '{model}' returned empty content")
        return text
