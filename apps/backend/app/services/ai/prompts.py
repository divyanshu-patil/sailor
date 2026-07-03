from typing import List

from app.schemas.deck_schema import AttachmentRequest, DeckGenerateRequest
from app.utils.enums.speaking_style import SpeakingStyle
from app.config.settings import settings

# index order must stay in sync with:
# frontend: constants/audiences.ts -> AUDIENCES
AUDIENCE_LEVELS = [
    "a general audience with mixed backgrounds and no assumed expertise",
    "senior executives and decision-makers — keep it high-level, strategic, and outcome-focused; avoid deep technical detail",
    "students — explain concepts clearly, build up from fundamentals, use relatable examples",
    "technical engineers and practitioners — comfortable with jargon, precise terminology, and implementation-level detail",
    "sales and marketing professionals — focus on value propositions, positioning, and audience/customer impact",
    "investors — emphasize market opportunity, traction, business viability, and ROI framing",
]


def _resolve_audience(audience_index: int) -> str:
    if 0 <= audience_index < len(AUDIENCE_LEVELS):
        return AUDIENCE_LEVELS[audience_index]
    return "a general audience"


def _build_attachments_context(attachments: List[AttachmentRequest]) -> str:
    if not attachments:
        return "No attachments were provided."
    lines = [f"- [{a.type}] {a.name} ({a.uri})" for a in attachments]
    return (
        "The user attached reference material below. Use their names/types as context "
        "for tone and subject matter (contents are not extracted yet — see TODO):\n"
        + "\n".join(lines)
    )


def build_deck_system_prompt() -> str:
    delivery_values = ", ".join(s.value for s in SpeakingStyle)
    return f"""You are an expert presentation writer and instructional designer.
You generate structured presentation content as strict JSON only — no prose, no markdown fences.

Output must be a single JSON object with this exact shape:
{{
  "title": string,
  "script": string,
  "color": string,
  "cards": [
    {{
      "title": string,
      "description": string,
      "color": string,
      "impact": number,
      "delivery": string
    }}
  ]
}}

Rules:
- Return ONLY valid JSON. No commentary, no markdown code fences.
- "cards" must contain exactly the number of cards requested.
- "delivery" must be exactly one of: {delivery_values}
- "color" fields must be valid hex strings like "#3B82F6".
- "impact" must be a number between 0.0 and 1.0.
- "script" must be detailed, speakable narration matching the requested duration and audience.

IMPORTANT:

The "delivery" field MUST be EXACTLY one of these strings.

Do not invent new values.
Do not use synonyms.
for delivery, only use one of the following: {delivery_values} strictly.

"""


def estimate_max_tokens(card_count: int, duration_minutes: int) -> int:
    """
    Rough JSON output budget: script scales with duration, cards scale with count.
    Clamped to the configured model's actual max output tokens.
    """
    script_tokens = duration_minutes * 220
    card_tokens = card_count * 130
    overhead = 300

    estimated = script_tokens + card_tokens + overhead
    return min(estimated, settings.AI_MAX_OUTPUT_TOKENS)


def build_deck_user_prompt(body: DeckGenerateRequest) -> str:
    audience_desc = _resolve_audience(body.audience_index)
    attachments_context = _build_attachments_context(body.attachments)

    return f"""Generate a presentation based on this brief:

Topic / description: {body.description}
Target duration: {body.duration_minutes} minutes
Audience: {audience_desc}
Number of cards to generate: {body.card_count}

{attachments_context}

Produce exactly {body.card_count} cards that together tell a coherent, well-paced story for a
{body.duration_minutes}-minute talk. Return the JSON object described in the system prompt.
"""