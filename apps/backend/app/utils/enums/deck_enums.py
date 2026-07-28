import enum
class GenerationStatus(str, enum.Enum):
    """Shared status enum for any async AI job (script, audio, cards, ...)."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    # Set only by an explicit user cancel. Kept distinct from FAILED because
    # nothing went wrong and there is nothing to report or retry — the app shows
    # "Stopped" rather than an error, and offers to start over.
    CANCELLED = "cancelled"

class ScriptVersionKind(str, enum.Enum):
    """How a given version of a script came to exist. Stored per version so the
    history can say *why* a script changed, not just that it did."""
    GENERATED = "generated"
    REVISED = "revised"
    EDITED = "edited"


class AudienceType(str, enum.Enum):
    """Audience type for script generation."""
    GENERAL = "general"
    EXECUTIVES = "executives"
    STUDENTS = "students"
    TECHNICAL = "technical"
    BUSINESS = "business"
    EDUCATIONAL = "educational"
    INVESTORS = "investors"
    # Faculty assessing delivery as much as content. Its own value rather than
    # folded into EDUCATIONAL (a classroom you are teaching) or GENERAL (no
    # assumed context), because the guidance is genuinely different: this
    # audience is scoring the presenter.
    FACULTY = "faculty"
