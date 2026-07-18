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