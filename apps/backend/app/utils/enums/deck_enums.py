import enum
class GenerationStatus(str, enum.Enum):
    """Shared status enum for any async AI job (script, audio, cards, ...)."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"