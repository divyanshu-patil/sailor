from dataclasses import dataclass
from typing import Protocol


class ProviderError(Exception):
    """A single provider call failed. Raised by every adapter so the caller
    doesn't have to know which SDK's exception hierarchy it's catching."""


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
