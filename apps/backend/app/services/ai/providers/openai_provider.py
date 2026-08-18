import logging
import time

from app.config.settings import settings
from app.services.ai.providers.base import (
    ChatRequest,
    ProviderError,
    RateLimitedError,
)

logger = logging.getLogger("celery")

# Reasoning models take `reasoning_effort` and reject `temperature`. Matched by
# name prefix because there is no capability flag on the completions API to ask.
_REASONING_PREFIXES = ("o1", "o3", "o4", "gpt-5")


def _retry_after(error) -> float | None:
    """Seconds the server asked us to wait, if it said so.

    Worth reading rather than guessing: a per-minute limit clears in seconds and
    a per-day one in hours, and only the response headers know which we hit.
    """
    headers = getattr(getattr(error, "response", None), "headers", None) or {}
    raw = headers.get("retry-after")
    if raw:
        try:
            return float(raw)
        except ValueError:
            pass
    # OpenRouter reports the reset as a unix timestamp in milliseconds.
    reset = headers.get("x-ratelimit-reset")
    if reset:
        try:
            return max(0.0, float(reset) / 1000 - time.time())
        except ValueError:
            pass
    return None


class OpenAIProvider:
    """
    OpenAI (and anything that speaks its chat-completions API — set
    OPENAI_BASE_URL to point at Groq, Together, OpenRouter, or a local server).

    `fast` maps to `reasoning_effort` on reasoning models, which is the only
    knob those expose, and is otherwise ignored: a non-reasoning model has no
    deliberation to skip, and sending the parameter to one is an error.
    """

    name = "openai"

    # OpenAI renamed this; most OpenAI-compatible gateways did not follow. An
    # unknown parameter is dropped rather than rejected, so getting it wrong
    # doesn't fail — it silently truncates at the model's own default.
    max_tokens_param = "max_completion_tokens"

    def models(self) -> list[str]:
        return [m for m in (settings.AI_MODEL, settings.AI_FALLBACK_MODEL) if m]

    def _credentials(self) -> tuple[str, str]:
        """(api_key, base_url). Its own method so an adapter that only differs
        in where it points — OpenRouter — is a two-line subclass."""
        return settings.OPENAI_API_KEY, settings.OPENAI_BASE_URL

    def _client(self):
        try:
            from openai import OpenAI
        except ImportError as e:  # pragma: no cover - depends on install extras
            raise ProviderError(
                f"AI_PROVIDER={self.name} requires the `openai` package."
            ) from e

        api_key, base_url = self._credentials()
        # Bounded for the same reason the Ollama client is: the beats run
        # concurrently, so one request left hanging holds up the whole
        # generation. Cut it loose and the next model answers in seconds.
        return OpenAI(
            api_key=api_key or None,
            base_url=base_url or None,
            timeout=settings.AI_REQUEST_TIMEOUT,
        )

    def complete(self, request: ChatRequest, model: str) -> str:
        import openai

        messages = [
            {"role": "system", "content": request.system},
            *(dict(message) for message in request.messages),
        ]
        if request.images:
            # Chat Completions accepts a data URL as an image_url. Attach the
            # images to the final user turn so provider adapters keep the same
            # conversation shape for repair/continuation calls too.
            for message in reversed(messages):
                if message.get("role") == "user":
                    text = str(message.get("content", ""))
                    message["content"] = [
                        {"type": "text", "text": text},
                        *(
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": (
                                        f"data:{image.media_type};base64,"
                                        f"{image.base64_data}"
                                    )
                                },
                            }
                            for image in request.images
                        ),
                    ]
                    break

        kwargs: dict = {
            "model": model,
            "messages": messages,
            self.max_tokens_param: request.max_tokens,
        }
        if any(model.startswith(prefix) for prefix in _REASONING_PREFIXES):
            kwargs["reasoning_effort"] = "low" if request.fast else "high"

        try:
            response = self._client().chat.completions.create(**kwargs)
        except openai.RateLimitError as e:
            raise RateLimitedError(
                f"'{model}' rate limited: {e}", retry_after=_retry_after(e)
            ) from e
        except openai.APIStatusError as e:
            # The status travels with the error so a subclass can react to one
            # without re-parsing the message — OpenRouter answers an exhausted
            # free budget with 402, which is a wait, not a failure.
            error = ProviderError(f"'{model}' failed ({e.status_code}): {e}")
            error.status_code = e.status_code
            raise error from e
        except openai.APIConnectionError as e:
            raise ProviderError(f"'{model}' unreachable: {e}") from e
        except Exception as e:
            raise ProviderError(f"'{model}' failed: {e}") from e

        content = (response.choices[0].message.content or "").strip()
        if not content:
            raise ProviderError(f"Model '{model}' returned empty content")
        return content
