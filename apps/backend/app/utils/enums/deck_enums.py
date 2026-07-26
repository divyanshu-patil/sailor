import enum
class GenerationStatus(str, enum.Enum):
    """Shared status enum for any async AI job (script, audio, cards, ...)."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class AudienceType(str, enum.Enum):
    """Audience type for script generation."""
    GENERAL = "general"
    EXECUTIVES = "executives"
    STUDENTS = "students"
    TECHNICAL = "technical"
    BUSINESS = "business"
    EDUCATIONAL = "educational"
    INVESTORS = "investors"