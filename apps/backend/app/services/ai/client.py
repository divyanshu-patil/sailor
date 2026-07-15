import logging
from typing import Optional

from openai import OpenAI, APIError, APITimeoutError, APIConnectionError

from app.config.settings import settings
from app.core.exceptions import AIGenerationError

logger = logging.getLogger(__name__)


class AIClient:
    """
    Thin wrapper around any OpenAI-compatible chat completion API.
    Swap providers via env vars only (see app/core/ai_config.py).
    """

    def __init__(self):
        self._model = settings.AI_MODEL
        self._max_retries = settings.AI_MAX_RETRIES
        self._client = OpenAI(
            api_key=settings.API_KEY,
            base_url=settings.AI_BASE_URL,
            timeout=settings.AI_TIMEOUT_SECONDS,
        )

    def generate_json(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.7,
        max_tokens: int | None = None,
    ) -> str:
        """Calls the chat completion endpoint in JSON mode, returns the raw JSON string."""
        last_error: Optional[Exception] = None

        for attempt in range(1, self._max_retries + 1):
            try:
                if max_tokens is not None:
                    response = self._client.chat.completions.create(
                        model=self._model,
                        temperature=temperature,
                        max_tokens=max_tokens,
                        response_format={"type": "json_object"},
                        messages=[
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt},
                        ],
                    )
                else:
                    response = self._client.chat.completions.create(
                        model=self._model,
                        temperature=temperature,
                        response_format={"type": "json_object"},
                        messages=[
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt},
                        ],
                    )
                content = response.choices[0].message.content
                if not content:
                    raise AIGenerationError("AI provider returned an empty response")

                return content
            except (APITimeoutError, APIConnectionError, APIError, AIGenerationError) as exc:
                last_error = exc
                logger.warning(
                    "AI call failed (attempt %s/%s): %s", attempt, self._max_retries, exc
                )

        raise AIGenerationError(
            f"AI provider failed after {self._max_retries} attempts: {last_error}"
        )