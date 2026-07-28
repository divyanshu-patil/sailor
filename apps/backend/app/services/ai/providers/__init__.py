from functools import lru_cache

from app.config.settings import settings
from app.services.ai.providers.base import (
    ChatProvider,
    ChatRequest,
    ProviderError,
)

__all__ = ["ChatProvider", "ChatRequest", "ProviderError", "get_provider"]

# Constructed lazily, per provider, so selecting one doesn't require the others'
# SDKs to be installed — the `anthropic` package isn't a hard dependency of an
# install that only ever talks to Ollama.
_BUILDERS = {
    "ollama": lambda: _build("ollama_provider", "OllamaProvider"),
    "anthropic": lambda: _build("anthropic_provider", "AnthropicProvider"),
    "openai": lambda: _build("openai_provider", "OpenAIProvider"),
}


def _build(module_name: str, class_name: str):
    from importlib import import_module

    module = import_module(f"app.services.ai.providers.{module_name}")
    return getattr(module, class_name)()


@lru_cache(maxsize=None)
def get_provider(name: str | None = None) -> ChatProvider:
    """The configured provider. Cached — an adapter holds no per-request state,
    and each one builds its own SDK client per call anyway."""
    key = (name or settings.AI_PROVIDER).strip().lower()
    builder = _BUILDERS.get(key)
    if builder is None:
        raise ProviderError(
            f"Unknown AI_PROVIDER '{key}'. Expected one of: {', '.join(sorted(_BUILDERS))}."
        )
    return builder()
