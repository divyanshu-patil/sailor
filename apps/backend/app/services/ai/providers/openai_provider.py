import logging

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


class OpenAIProvider:
    """
    OpenAI (and anything that speaks its chat-completions API — set
    OPENAI_BASE_URL to point at Groq, Together, OpenRouter, or a local server).

    `fast` maps to `reasoning_effort` on reasoning models, which is the only
    knob those expose, and is otherwise ignored: a non-reasoning model has no
    deliberation to skip, and sending the parameter to one is an error.
    """

    name = "openai"

    def models(self) -> list[str]:
        return [m for m in (settings.AI_MODEL, settings.AI_FALLBACK_MODEL) if m]

    def _client(self):
        try:
            from openai import OpenAI
        except ImportError as e:  # pragma: no cover - depends on install extras
            raise ProviderError(
                "AI_PROVIDER=openai requires the `openai` package."
            ) from e

        return OpenAI(
            api_key=settings.OPENAI_API_KEY or None,
            base_url=settings.OPENAI_BASE_URL or None,
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
            "max_completion_tokens": request.max_tokens,
        }
        if any(model.startswith(prefix) for prefix in _REASONING_PREFIXES):
            kwargs["reasoning_effort"] = "low" if request.fast else "high"

        try:
            response = self._client().chat.completions.create(**kwargs)
        except openai.RateLimitError as e:
            raise RateLimitedError(f"'{model}' rate limited: {e}") from e
        except openai.APIStatusError as e:
            raise ProviderError(f"'{model}' failed ({e.status_code}): {e}") from e
        except openai.APIConnectionError as e:
            raise ProviderError(f"'{model}' unreachable: {e}") from e
        except Exception as e:
            raise ProviderError(f"'{model}' failed: {e}") from e

        content = (response.choices[0].message.content or "").strip()
        if not content:
            raise ProviderError(f"Model '{model}' returned empty content")
        return content
