import enum


class SituationTag(str, enum.Enum):
    """The real-world scenario a day's snippet is written for.

    Its own enum rather than a reuse of DeckCategory, which is where these
    values started. DeckCategory is documented as a closed, deliberately small
    list because it renders as Discover's filter row — adding
    `technical_explanation` or `leadership_talk` there would put speaking
    scenarios into the deck feed's filters, where they mean nothing. The first
    eight values are kept identical to DeckCategory's so the two vocabularies
    still line up where they overlap.
    """
    INTERVIEW = "interview"
    SALES = "sales"
    ACADEMIC = "academic"
    BUSINESS = "business"
    CONFERENCE = "conference"
    SOCIAL = "social"
    TEACHING = "teaching"
    OTHER = "other"

    # Added for the framework library — scenarios a presentation-practice app
    # needs that a deck category never did.
    TECHNICAL_EXPLANATION = "technical_explanation"
    NETWORKING = "networking"
    LEADERSHIP_TALK = "leadership_talk"
    PRODUCT_DEMO = "product_demo"


#: Display labels for the "Best for" pills in the framework explainer. Kept
#: beside the enum so a new tag can't ship without one.
SITUATION_LABELS: dict[SituationTag, str] = {
    SituationTag.INTERVIEW: "Interviews",
    SituationTag.SALES: "Sales",
    SituationTag.ACADEMIC: "Academic",
    SituationTag.BUSINESS: "Business",
    SituationTag.CONFERENCE: "Talks",
    SituationTag.SOCIAL: "Social",
    SituationTag.TEACHING: "Teaching",
    SituationTag.OTHER: "Anything",
    SituationTag.TECHNICAL_EXPLANATION: "Technical explanation",
    SituationTag.NETWORKING: "Networking",
    SituationTag.LEADERSHIP_TALK: "Leadership",
    SituationTag.PRODUCT_DEMO: "Product demos",
}

assert set(SITUATION_LABELS) == set(SituationTag), "every situation needs a label"
