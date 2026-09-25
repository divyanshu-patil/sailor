from enum import Enum

class SpeakingStyle(str, Enum):
    # Core
    DRAMATIC = "dramatic"
    CONFIDENT = "confident"
    EXPLAINING = "explaining"
    CURIOUS = "curious"
    STORYTELLING = "storytelling"
    ENERGETIC = "energetic"
    PAUSE = "pause"

    # Teaching
    EDUCATIONAL = "educational"
    ANALYTICAL = "analytical"
    STEP_BY_STEP = "step_by_step"
    TECHNICAL = "technical"

    # Presentation
    INTRODUCTION = "introduction"
    SUMMARY = "summary"
    CONCLUSION = "conclusion"
    TRANSITION = "transition"
    EMPHASIS = "emphasis"

    # Tone
    FRIENDLY = "friendly"
    CASUAL = "casual"
    FORMAL = "formal"
    PROFESSIONAL = "professional"
    INSPIRATIONAL = "inspirational"
    MOTIVATIONAL = "motivational"
    PERSUASIVE = "persuasive"
    HUMOROUS = "humorous"

    # Pace
    CALM = "calm"
    SERIOUS = "serious"
    EXCITED = "excited"
    URGENT = "urgent"
    REFLECTIVE = "reflective"

    # Interaction
    QUESTIONING = "questioning"
    INTERACTIVE = "interactive"
    THOUGHT_PROVOKING = "thought_provoking"
