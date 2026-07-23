import enum


class DeckGenerationStatus(str, enum.Enum):
    """
    Status of whichever async AI job is currently active on the deck.

    PENDING / PROCESSING   -> script generation queued / running
    SCRIPT_READY           -> script done, paused for user revise/edit/confirm
    REVISING                -> AI revision of the script in progress
    GENERATING_CARDS       -> confirmed, card-generation task running
    COMPLETED               -> cards generated, deck fully done
    FAILED / CANCELLED     -> terminal end states
    """
    PENDING = "pending"
    PROCESSING = "processing"
    SCRIPT_READY = "script_ready"
    REVISING = "revising"
    GENERATING_CARDS = "generating_cards"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

    @property
    def is_active(self) -> bool:
        """True while a Celery task is actually running for this deck.
        Used by the ws to decide whether to keep listening or send-and-close."""
        return self in (
            DeckGenerationStatus.PENDING,
            DeckGenerationStatus.PROCESSING,
            DeckGenerationStatus.REVISING,
            DeckGenerationStatus.GENERATING_CARDS,
        )


class AudienceType(str, enum.Enum):
    """Audience type for script generation."""
    GENERAL = "general"
    EXECUTIVES = "executives"
    STUDENTS = "students"
    TECHNICAL = "technical"
    BUSINESS = "business"
    EDUCATIONAL = "educational"
    INVESTORS = "investors"