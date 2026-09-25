class AIGenerationError(Exception):
    """Raised when the upstream AI provider call fails (network, timeout, 5xx, etc.)."""


class AIResponseParsingError(Exception):
    """Raised when the AI response can't be parsed into the expected schema."""
