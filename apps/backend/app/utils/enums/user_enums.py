import enum
class ExperienceLevel(str, enum.Enum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    PRO = "pro"


class Profession(str, enum.Enum):
    BUSINESS = "business"
    TECH = "tech"
    SALES_MARKETING = "sales_marketing"
    ACADEMIC = "academic"
    STUDENT = "student"
    HEALTHCARE = "healthcare"
    FINANCE_CONSULTING = "finance_consulting"
    LEGAL = "legal"
    CREATIVE = "creative"
    GOVERNMENT_NONPROFIT = "government_nonprofit"
    OTHER = "other"

class ScriptMood(str, enum.Enum):
    """Emotional tone a script is written in.

    Mirrors ScriptMood on the client and the free-text `default_mood` column on
    user_preferences — that column predates this enum, which is why it is still
    a String there and validated here at the boundary instead.
    """
    CONFIDENT = "confident"
    CALM = "calm"
    PLAYFUL = "playful"
    REFLECTIVE = "reflective"
    ENERGETIC = "energetic"
