import logging

from app.config.settings import settings
from app.services.ai.providers.base import (
    ChatRequest,
    ProviderError,
    RateLimitedError,
)

logger = logging.getLogger("celery")

OLLAMA_CLOUD_HOST = "https://ollama.com"

# Models that reject the `think` parameter outright rather than ignoring it,
# discovered at runtime and remembered for the life of the process. Matched on
# the error text because Ollama reports it as a generic 400.
_THINK_UNSUPPORTED_MARKERS = ("think", "thinking")
_no_think_models: set[str] = set()


class OllamaProvider:
    name = "ollama"

    def models(self) -> list[str]:
        return [m for m in (settings.AI_MODEL, settings.AI_FALLBACK_MODEL) if m]

    def _client(self):
        from ollama import Client

        return Client(
            host=settings.OLLAMA_HOST or OLLAMA_CLOUD_HOST,
            headers={"Authorization": f"Bearer {settings.OLLAMA_API_KEY}"},
        )

    def _call(self, model: str, request: ChatRequest, *, think: bool | None) -> str:
        messages = [
            {"role": "system", "content": request.system},
            *(dict(message) for message in request.messages),
        ]
        if request.image is not None:
            for message in reversed(messages):
                if message.get("role") == "user":
                    message["images"] = [request.image.base64_data]
                    break

        kwargs: dict = {
            "model": model,
            "messages": messages,
            "stream": False,
        }
        if think is not None:
            kwargs["think"] = think

        response = self._client().chat(**kwargs)
        content = (response.get("message", {}) or {}).get("content", "").strip()
        if not content:
            raise ProviderError(f"Model '{model}' returned empty content")
        return content

    def complete(self, request: ChatRequest, model: str) -> str:
        """
        `think` is Ollama's own knob and maps directly onto `fast`.

        A model with no reasoning mode rejects the parameter instead of ignoring
        it, which would otherwise fail every call the moment fast mode is on. It
        is retried once without the parameter and remembered, so turning fast
        mode on can only ever make things quicker, never break them.
        """
        think = None if model in _no_think_models else (not request.fast)

        try:
            return self._call(model, request, think=think)
        except ProviderError:
            raise
        except Exception as e:
            detail = str(getattr(e, "error", e)).lower()

            # Ollama Cloud caps concurrent requests per account, and this
            # pipeline fans out deliberately — a 429 means we out-ran ourselves,
            # not that anything is wrong. Its own type so the caller waits and
            # retries instead of burning the fallback against the same budget.
            if getattr(e, "status_code", None) == 429 or "too many" in detail:
                raise RateLimitedError(f"'{model}' rate limited: {detail}") from e

            if think is not None and any(m in detail for m in _THINK_UNSUPPORTED_MARKERS):
                logger.info(f"[ai] '{model}' doesn't accept `think`; retrying without it")
                _no_think_models.add(model)
                try:
                    return self._call(model, request, think=None)
                except Exception as retry_error:
                    raise ProviderError(f"'{model}' failed: {retry_error}") from retry_error
            raise ProviderError(f"'{model}' failed: {e}") from e
