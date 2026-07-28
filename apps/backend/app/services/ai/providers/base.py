from dataclasses import dataclass
from typing import Protocol


class ProviderError(Exception):
    """A single provider call failed. Raised by every adapter so the caller
    doesn't have to know which SDK's exception hierarchy it's catching."""


class RateLimitedError(ProviderError):
    """
    The provider refused because too much was in flight — a 429.

    Its own type because the right response differs from any other failure in
    two ways. It's transient, so the same call is worth retrying after a wait
    rather than counting as a failure. And falling through to the fallback model
    doesn't help: the limit is on the account, not the model, so the fallback
    request lands in the same exhausted budget and fails immediately — which is
    exactly what the logs showed, two instant 429s per attempt.
    """

    def __init__(self, message: str, retry_after: float | None = None):
        super().__init__(message)
        # Seconds the provider asked us to wait, on the providers that say so.
        self.retry_after = retry_after


@dataclass(frozen=True)
class ChatRequest:
    """
    One completion, in provider-neutral terms.

    `system` is separated from the conversation rather than being the first
    message, because that's the only shape every provider can express: Anthropic
    takes it as its own top-level parameter, and the OpenAI and Ollama adapters
    can trivially push it back onto the front of their message list. Going the
    other way — starting with a system message and trying to pull it out — is
    guesswork the moment a caller sends two of them.
    """

    system: str
    messages: list[dict]

    # "Answer, don't deliberate."
    #
    # Every call this app makes is heavily prompt-constrained — a fixed script
    # skeleton, a per-beat role, an explicit word target, a JSON shape — so the
    # reasoning pass is mostly re-deriving what the prompt already says, on the
    # user's clock. Each provider maps this onto whatever knob it actually has;
    # a provider with no such knob ignores it.
    fast: bool = True

    max_tokens: int = 16000


class ChatProvider(Protocol):
    """What the AI layer needs from a provider. Deliberately one method: this
    app asks for text completions and nothing else, so a provider is a function
    from a request to a string plus the models to try."""

    name: str

    def models(self) -> list[str]:
        """Primary model first, fallbacks after. Tried in order."""
        ...

    def complete(self, request: ChatRequest, model: str) -> str:
        """Run one completion. Raises ProviderError on any failure."""
        ...
