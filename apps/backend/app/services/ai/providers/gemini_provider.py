import logging
import re
import threading

from app.config.settings import settings
from app.services.ai.providers.base import (
    ChatRequest,
    ProviderError,
    RateLimitedError,
)

logger = logging.getLogger("celery")

# Models that reject `thinking_level` rather than ignoring it — the older Flash
# releases have no reasoning pass to configure. Discovered at runtime and
# remembered for the life of the process, same as the Ollama adapter does with
# `think`: matched on the error text because it arrives as a generic 400.
_THINKING_UNSUPPORTED_MARKERS = ("thinking_level", "thinking")
_no_thinking_models: set[str] = set()

# Gemini answers a 429 with a RetryInfo in the error body — `retryDelay: "37s"`.
# It is nested a few levels down in a dict that the SDK hands back verbatim, so
# it's cheaper to read it off the repr than to walk the shape defensively.
_RETRY_DELAY_PATTERN = re.compile(r"retryDelay[\"']?\s*[:=]\s*[\"']?(\d+(?:\.\d+)?)s")


class GeminiProvider:
    """
    Gemini, via the official `google-genai` SDK's Interactions API.

    Two things differ from the other adapters:

    - A conversation is a list of *steps*, not messages: each turn is tagged
      `user_input` or `model_output` rather than carrying a role. Card repair
      sends one assistant turn back for correction, so the mapping has to handle
      both; everything else in this app is a single user turn.
    - The system prompt is a top-level parameter, which is why ChatRequest keeps
      `system` separate from the messages.

    `fast` maps to `thinking_level`. Gemini's Flash models think by default and
    lowering the level is the supported way to skip it — the level is capped, not
    switched off, so there is no risk of the model losing the plan it needs for a
    JSON-shaped answer.
    """

    name = "gemini"

    def __init__(self):
        self._cached_client = None
        self._client_lock = threading.Lock()

    def models(self) -> list[str]:
        return [m for m in (settings.AI_MODEL, settings.AI_FALLBACK_MODEL) if m]

    def _client(self):
        """
        One client for the life of the process, unlike the other adapters.

        Two reasons, and the first is not optional: this SDK's client closes its
        transport when it is garbage collected, so a per-call client built inline
        can be finalised out from under the request it was made for ("Cannot send
        a request, as the client has been closed"). Holding it also means the
        fan-out shares one connection pool instead of standing up a new one per
        beat. The client is thread-safe; only the construction needs guarding.
        """
        if self._cached_client is not None:
            return self._cached_client

        try:
            from google import genai
        except ImportError as e:  # pragma: no cover - depends on install extras
            raise ProviderError(
                "AI_PROVIDER=gemini requires the `google-genai` package. "
                "Install it with `uv add google-genai`."
            ) from e

        with self._client_lock:
            if self._cached_client is None:
                # A bare constructor also picks up GEMINI_API_KEY or
                # GOOGLE_API_KEY from the environment, so an unset setting is not
                # necessarily an error.
                self._cached_client = genai.Client(api_key=settings.GEMINI_API_KEY or None)
        return self._cached_client

    @staticmethod
    def _steps(messages: list[dict], images=()) -> list[dict]:
        """The app's `{role, content}` messages as Interactions steps."""
        steps: list[dict] = []
        last_user_message = next(
            (index for index in range(len(messages) - 1, -1, -1) if messages[index].get("role") == "user"),
            None,
        )
        for index, message in enumerate(messages):
            text = str(message.get("content", "") or "")
            content: list[dict] = []
            if text:
                content.append({"type": "text", "text": text})
            if images and index == last_user_message:
                content.extend(
                    {
                        "type": "image",
                        "data": image.base64_data,
                        "mime_type": image.media_type,
                    }
                    for image in images
                )
            if not content:
                continue
            role = message.get("role")
            steps.append(
                {
                    "type": "model_output" if role in ("assistant", "model") else "user_input",
                    "content": content,
                }
            )
        return steps

    @staticmethod
    def _status_code(error) -> int | None:
        """
        The HTTP status behind a failure, whichever error family raised it.

        The Interactions API raises its own exceptions (`status_code`) rather
        than the ones in `google.genai.errors` (`code`), and both live behind the
        same client. Reading the attribute instead of matching the class keeps
        this off the SDK's private module path, where those Interactions
        exceptions are currently defined.
        """
        for attribute in ("status_code", "code"):
            value = getattr(error, attribute, None)
            if isinstance(value, int):
                return value
        return None

    @staticmethod
    def _retry_after(error) -> float | None:
        """Seconds Gemini asked us to wait, from the header or the RetryInfo."""
        headers = getattr(getattr(error, "response", None), "headers", None)
        if headers:
            value = headers.get("retry-after")
            if value:
                try:
                    return float(value)
                except (TypeError, ValueError):
                    pass

        body = getattr(error, "body", None) or getattr(error, "details", None) or ""
        match = _RETRY_DELAY_PATTERN.search(str(body))
        return float(match.group(1)) if match else None

    def _call(self, model: str, request: ChatRequest, *, thinking: str | None) -> str:
        generation_config: dict = {"max_output_tokens": request.max_tokens}
        if thinking is not None:
            generation_config["thinking_level"] = thinking

        body: dict = {
            "model": model,
            "input": self._steps(request.messages, request.images),
            "generation_config": generation_config,
        }
        if request.system:
            body["system_instruction"] = request.system

        interaction = self._client().interactions.create(**body)

        # Safety filters and blocked prompts come back as a normal 200 with a
        # terminal status and no output, rather than as an error.
        if interaction.status == "failed":
            raise ProviderError(f"'{model}' declined the request ({interaction.status})")

        text = (interaction.output_text or "").strip()
        if not text:
            raise ProviderError(f"Model '{model}' returned empty content")
        return text

    def complete(self, request: ChatRequest, model: str) -> str:
        thinking = None if model in _no_thinking_models else ("LOW" if request.fast else "HIGH")

        try:
            return self._call(model, request, thinking=thinking)
        except ProviderError:
            raise
        except Exception as e:
            status = self._status_code(e)

            # Transient and project-scoped — wait rather than falling through to
            # a fallback drawing on the same quota.
            if status == 429:
                raise RateLimitedError(
                    f"'{model}' rate limited: {e}", retry_after=self._retry_after(e)
                ) from e

            detail = str(e).lower()
            if thinking is not None and any(m in detail for m in _THINKING_UNSUPPORTED_MARKERS):
                logger.info(f"[ai] '{model}' doesn't accept `thinking_level`; retrying without it")
                _no_thinking_models.add(model)
                try:
                    return self._call(model, request, thinking=None)
                except ProviderError:
                    raise
                except Exception as retry_error:
                    raise ProviderError(f"'{model}' failed: {retry_error}") from retry_error

            where = f" ({status})" if status else ""
            raise ProviderError(f"'{model}' failed{where}: {e}") from e
