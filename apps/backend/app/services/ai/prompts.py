import json
from typing import List, Sequence

from app.schemas.deck_schema import AttachmentRequest, DeckGenerateRequest
from app.services.ai.presentation_math import calculateTargetWords, calculateWordsPerCard, getWordsPerMinute
from app.utils.enums.speaking_style import SpeakingStyle


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


PRESENTATION_CARD_REFERENCE = """Presentation card guidance from strong examples:

1. Presentation cards should describe one continuous narrative.
    - Opening should hook the audience immediately.
    - Body content should flow smoothly without section labels or outline style fragments.
    - Closing should land a clear takeaway and call to action.

2. Strong presentation cards are detailed, not compressed.
    - Expand each idea into several explanatory sentences.
    - Add examples, analogies, and audience-specific language.
    - Avoid short summary style output unless the user explicitly asks for it.

3. Strong presentation cards may use only bold and italic for emphasis.
    - Do not use bullet points, numbered lists, tables, headings, or timestamps.
    - Do not insert section markers like 0:00, 1:30, or [pause].
    - Do not output line breaks inside the speaker notes text.

Example patterns the model should follow:
- Investor pitch: introduction, funding request, investor value, conclusion.
- Earnings report: calm and confident narration with slower pacing for facts.
- Product launch: dialogue with visual cues and clear transitions.

Writing rules:
- Start with a catchy hook.
- Tailor the wording to the audience.
- Keep points concise but detailed enough to speak naturally.
- Include visual or slide cues when relevant.
- Tell a story where it helps the audience understand the topic.
- Use humor or anecdotes only when appropriate.
- End with a clear call to action.
- Rehearse-friendly wording should sound professional and fluid.
"""


def build_card_system_prompt() -> str:
    delivery_values = ", ".join(s.value for s in SpeakingStyle)
    return f"""You are an expert presentation designer.
You generate sequential presentation cards as strict JSON only.

Use the reference guidance below as style inspiration, not as text to copy:

{PRESENTATION_CARD_REFERENCE}

Output must be a single JSON object with this exact shape:
{{
    "cards": [
        {{
            "cardNumber": number,
            "title": string,
            "speakerNotes": string,
            "slideContent": [string],
            "estimatedWordCount": number,
            "estimatedDurationSeconds": number,
            "color": string,
            "impact": number,
            "delivery": string
        }}
    ]
}}

Rules:
- Return ONLY valid JSON. No commentary, no markdown fences.
- "cards" must contain exactly the number of cards requested for this batch.
- Card titles should be short, presentation-ready slide titles for one continuous talk.
- Card speaker notes should be detailed, but each card must still act as one sequential slide in the presentation.
- Generate an internal outline before writing the cards, but do not output the outline.
- Expand each outline section into exactly one card.
- The complete presentation should read as one chronological conversation from start to finish.
- Every card must introduce new information and continue directly from the previous card.
- Do not summarize prior cards.
- Do not restart the presentation on any card.
- "delivery" must be exactly one of: {delivery_values}
- "color" fields must be valid hex strings like "#3B82F6".
- "impact" must be a number between 0.0 and 1.0.
- Do not repeat cards already generated in earlier batches.
- Use the presentation outline as the source of truth for ordering and emphasis.
"""


def build_card_generation_user_prompt(body: DeckGenerateRequest) -> str:
    audience_desc = _resolve_audience(body.audience_index)
    attachments_context = _build_attachments_context(body.attachments)
    words_per_minute = getWordsPerMinute(body.audience_index)
    target_words = calculateTargetWords(body.duration_minutes, body.audience_index)
    words_per_card = calculateWordsPerCard(target_words, body.card_count)

    return f"""Generate a presentation based on this brief:

Topic / description: {body.description}
Target duration: {body.duration_minutes} minutes
Audience: {audience_desc}
Target number of cards: {body.card_count}
Assume a speaking speed of {words_per_minute} words per minute.
Generate approximately {target_words} spoken words.
Generate EXACTLY {body.card_count} presentation cards.
Each card should contain approximately {words_per_card} spoken words.
The complete presentation should take approximately {body.duration_minutes} minutes to present.

{attachments_context}

Generate one continuous presentation where every card is the chronological continuation of the previous one.
Before writing the cards, create an internal outline with enough sections to satisfy the requested card count.
Do not expose the outline.
Then expand each section into exactly one card.
Never restart the presentation.
Never repeat concepts.
Never duplicate cards.
Do not summarize previous cards.
Every card must introduce new information and move the presentation forward.

Return the JSON object described in the system prompt.
"""


def build_card_expansion_user_prompt(
    body: DeckGenerateRequest,
    *,
    current_script: str,
    target_words: int,
) -> str:
    audience_desc = _resolve_audience(body.audience_index)
    words_per_minute = getWordsPerMinute(body.audience_index)
    words_per_card = calculateWordsPerCard(target_words, body.card_count)
    attachments_context = _build_attachments_context(body.attachments)

    return f"""The current presentation is too short.

Topic / description: {body.description}
Target duration: {body.duration_minutes} minutes
Audience: {audience_desc}
Target number of cards: {body.card_count}
Assume a speaking speed of {words_per_minute} words per minute.
Generate approximately {target_words} spoken words.
Each card should contain approximately {words_per_card} spoken words.

Current presentation script:
{current_script}

{attachments_context}

Preserve all existing content.
Preserve card order.
Preserve presentation flow.
Expand explanations.
Add examples.
Improve transitions.
Increase detail.
Reach approximately the target word count.
Do NOT summarize.
Do NOT rewrite from scratch.
Only expand the existing presentation.

Return the JSON object described in the system prompt.
"""


def estimate_script_max_tokens(duration_minutes: int) -> None:
    return None


def estimate_card_batch_max_tokens(batch_size: int, duration_minutes: int) -> None:
    return None


def estimate_card_batch_size(card_count: int) -> int:
    if card_count <= 4:
        return card_count
    if card_count <= 12:
        return 4
    if card_count <= 24:
        return 5
    return 6


def _cards_context(cards: Sequence[dict]) -> str:
    if not cards:
        return "No cards have been generated yet."
    serializable_cards = []
    for card in cards:
        if hasattr(card, "model_dump"):
            serializable_cards.append(card.model_dump())
        elif isinstance(card, dict):
            serializable_cards.append(card)
        else:
            serializable_cards.append(dict(card))
    return json.dumps(serializable_cards, indent=2, ensure_ascii=True)


def _attachments_context(attachments: List[AttachmentRequest]) -> str:
    return _build_attachments_context(attachments)


def build_script_system_prompt() -> str:
    return build_card_system_prompt()


def build_script_user_prompt(body: DeckGenerateRequest) -> str:
    return build_card_generation_user_prompt(body)


def build_card_batch_user_prompt(
    body: DeckGenerateRequest,
    *,
    script_title: str,
    script: str,
    generated_cards: Sequence[dict],
    batch_size: int,
    batch_start_index: int,
) -> str:
    audience_desc = _resolve_audience(body.audience_index)
    attachments_context = _attachments_context(body.attachments)
    cards_context = _cards_context(generated_cards[-8:])
    batch_end_index = batch_start_index + batch_size - 1
    words_per_minute = getWordsPerMinute(body.audience_index)
    target_words = calculateTargetWords(body.duration_minutes, body.audience_index)
    words_per_card = calculateWordsPerCard(target_words, body.card_count)

    return f"""Generate slide cards for the presentation below.

Topic / description: {body.description}
Target duration: {body.duration_minutes} minutes
Audience: {audience_desc}
Target number of cards: {body.card_count}
Assume a speaking speed of {words_per_minute} words per minute.
Generate approximately {target_words} spoken words.
Each card should contain approximately {words_per_card} spoken words.
This batch should generate cards {batch_start_index}-{batch_end_index}.
Treat these cards as consecutive slides in one presentation, not independent summaries.

Script title: {script_title}

Script:
{script}

Previous cards context (most recent cards only):
{cards_context}

{attachments_context}

Instructions:
- Generate exactly {batch_size} new cards for this batch.
- Keep the cards in the same narrative order as the script.
- Make each card a sequential slide that advances the same presentation.
- Make each card a detailed continuation of the topic, not a standalone recap.
- Use concise titles and detailed descriptions.
- Avoid repeating ideas from the previous cards context.
- Return JSON only.
"""
