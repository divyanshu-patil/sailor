
from app.utils.enums.deck_enums import AudienceType

AUDIENCE_GUIDANCE: dict[AudienceType, str] = {
    AudienceType.GENERAL: (
        "General public, no assumed background. Avoid jargon; explain any "
        "technical term in plain language the moment it appears. Lean on "
        "everyday analogies and concrete, relatable examples."
    ),
    AudienceType.EXECUTIVES: (
        "Senior, time-pressed decision-makers. Lead with the bottom line and "
        "business impact before the supporting detail. Favor short, "
        "high-conviction statements over long build-up. Reference ROI, risk, "
        "and strategic implications where relevant."
    ),
    AudienceType.STUDENTS: (
        "Students still building foundational knowledge. Define new terms "
        "clearly, build ideas step by step, and use encouraging, energetic "
        "language. Concrete examples aid retention."
    ),
    AudienceType.TECHNICAL: (
        "Technically fluent audience (engineers, researchers, specialists). "
        "Precision matters more than simplification — use correct "
        "terminology and don't over-explain fundamentals they already know. "
        "Depth and rigor are welcome."
    ),
    AudienceType.BUSINESS: (
        "Business professionals focused on practical application. Emphasize "
        "actionable takeaways, market context, and real-world use cases over "
        "theory."
    ),
    AudienceType.EDUCATIONAL: (
        "A learning-focused setting (classroom, training, workshop). "
        "Prioritize clarity and structure, check understanding periodically, "
        "and reinforce key points through brief recap."
    ),
    AudienceType.INVESTORS: (
        "Investors evaluating opportunity and risk. Emphasize market size, "
        "traction, differentiation, and financial credibility. Be confident "
        "and persuasive without overselling; anticipate skepticism."
    ),
}

# ~140 words/minute is a natural, unhurried spoken pace
WORDS_PER_MINUTE = 140

MARKDOWN_RULES = (
    "OUTPUT FORMAT — Markdown, following these conventions exactly:\n\n"
    "- Continuous spoken prose in short paragraphs. Never slide bullet points, "
    "never a slide-by-slide outline, never a numbered or bulleted list of any "
    "kind — not even for steps, pillars, or phases. If the content is "
    "naturally a list of things, narrate it as a flowing sentence instead "
    "(e.g. 'first ... then ... and finally ...') rather than breaking it onto "
    "separate lines.\n"
    "- Start with a single `## Section Title` header as the very first line — "
    "a private navigation cue for the presenter, never read aloud.\n"
    "- Use **bold** only on the specific word or short phrase the presenter "
    "should vocally stress — a key number, the core claim. Sparingly, never "
    "whole sentences.\n"
    "- Use *italics* for delivery notes and asides not meant to be read "
    "verbatim — a tone cue like *(slow down here)*.\n"
    "- Mark a pause on its own line as a blockquote: `> *(pause)*`.\n"
    "- Mark direct audience engagement as a blockquote: "
    '`> **Ask the room:** "..."` followed by `> *(pause for responses)*` on '
    "the next line — only if explicitly requested for this section below.\n"
    "- No other Markdown: no tables, no links, no code blocks.\n"
)

GOOD_EXAMPLE = (
    "Example of correct style (this snippet is deliberately short to "
    "illustrate formatting only — your actual section must hit the word "
    "target given below, which will be considerably longer than this):\n\n"
    "## Opening\n"
    "Picture this: **three minutes** before a client call, and the numbers "
    "you were counting on are wrong.\n\n"
    "*(pause)*\n\n"
    "That sinking feeling is exactly why *forecasting discipline* is our "
    "whole talk today.\n"
)

BAD_EXAMPLE = (
    "Example of what NOT to do — never produce output shaped like this, even "
    "though the underlying content (three factors) is legitimate to explain:\n\n"
    "There are three factors that matter:\n"
    "1. Speed\n"
    "2. Cost\n"
    "3. Quality\n\n"
    "Correct version of the same content, narrated as prose instead: "
    '"Three things matter here: how fast you move, what it costs you, and '
    'whether the quality holds up under pressure."\n'
)


def section_count_for_duration(duration_mins: int) -> int:
    """Fixed section count instead of asking the model to pick within a range —
    ranges are exactly what got ignored (6 sections came back for a 2-4 ask)."""
    if duration_mins <= 7:
        return 2
    if duration_mins <= 15:
        return 3
    return 4


def word_budget(duration_mins: int) -> tuple[int, int, int]:
    """Returns (opening_words, closing_words, body_words_total)."""
    target_words = duration_mins * WORDS_PER_MINUTE
    opening_words = max(120, round(target_words * 0.08))
    closing_words = max(100, round(target_words * 0.06))
    body_words = max(200, target_words - opening_words - closing_words)
    return opening_words, closing_words, body_words

def build_outline_prompt(
    description: str, duration_mins: int, audience: AudienceType
) -> list[dict]:
    """Step 1 of the pipeline: ask for a structural plan *and* a generated
    title (small, easy-to-verify output), not the full script. Section count
    and word budget are enforced here with a hard number rather than a range."""
    n_sections = section_count_for_duration(duration_mins)
    _, _, body_words = word_budget(duration_mins)
    audience_note = AUDIENCE_GUIDANCE.get(audience, AUDIENCE_GUIDANCE[AudienceType.GENERAL])

    system = (
        "You are a presentation script planner. Respond with ONLY a JSON "
        "object and nothing else — no prose, no markdown code fences, no "
        "commentary before or after. The object must match exactly this "
        "shape:\n"
        '{"title": string, "sections": [{"title": string, "target_words": '
        'integer, "key_points": [string, string, ...]}]}\n\n'
        "\"title\" is the presentation's own title — a compelling, concise "
        "title (roughly 3-10 words, no trailing punctuation) capturing the "
        "essence of the brief below. It is separate from any section title "
        "and should not just restate one.\n"
        f"Produce EXACTLY {n_sections} section objects — not one more, not "
        "one fewer, no matter how many topics feel relevant. Combine related "
        "ideas into the same section rather than adding new ones.\n"
        f"The target_words values across all sections must sum to "
        f"approximately {body_words} (this excludes the opening and closing, "
        "which are generated separately).\n"
        "2-3 key_points per section is enough — short phrases, not full "
        "sentences."
    )
    user = (
        f"Brief: {description}\n"
        f"Audience: {audience.value} — {audience_note}\n"
        f"Duration: {duration_mins} minutes."
    )
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def build_section_prompt(
    *,
    kind: str,  # "opening" | "body" | "closing"
    heading: str,
    key_points: list[str] | None,
    target_words: int,
    title: str,
    audience: AudienceType,
    include_question: bool,
) -> list[dict]:
    """Step 2 of the pipeline: generate ONE section with its own achievable word
    target, rather than the whole script at once."""
    audience_note = AUDIENCE_GUIDANCE.get(audience, AUDIENCE_GUIDANCE[AudienceType.GENERAL])

    role_note = {
        "opening": "This is the OPENING of the script — hook the audience in the first two sentences.",
        "closing": "This is the CLOSING of the script — land on a strong final line, no new information.",
        "body": "This is one section in the middle of the script — assume the audience already heard the opening.",
    }[kind]

    points_note = ""
    if key_points:
        points_note = "Cover these points: " + "; ".join(key_points) + ".\n"

    ask_note = (
        "\nInclude exactly one audience-engagement moment "
        '(`> **Ask the room:** "..."` followed by `> *(pause for responses)*`) '
        "somewhere in this section, wherever it fits naturally."
        if include_question
        else ""
    )

    system = (
        "You are an expert presentation scriptwriter, continuing work on a "
        "single section of a longer spoken-word script.\n\n"
        + MARKDOWN_RULES
        + "\n"
        + GOOD_EXAMPLE
        + "\n"
        + BAD_EXAMPLE
        + "\n"
        + f"{role_note}\n\n"
        + f"HARD LENGTH REQUIREMENT: write approximately {target_words} words "
        f"for this section — treat {round(target_words * 0.9)} words as an "
        "absolute floor. If you are unsure whether you've written enough, "
        "keep going rather than wrapping up early.\n\n"
        f"Tailor vocabulary, tone, and examples to this audience: "
        f"{audience.value} — {audience_note}"
    )
    user = (
        f"Presentation title: {title}\n"
        f"Section heading to use in the `## ` header: {heading}\n"
        f"{points_note}"
        f"Target length: ~{target_words} words.{ask_note}"
    )
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def build_continuation_message(remaining_words: int) -> dict:
    """Appended to an in-progress section's message history when it came back short."""
    return {
        "role": "user",
        "content": (
            "Continue directly from where you left off — do not repeat or "
            f"summarize what you already wrote. Add approximately "
            f"{remaining_words} more words, maintaining the same style, "
            "formatting rules, and section (do not start a new `## ` header)."
        ),
    }


def build_delist_prompt(text: str) -> list[dict]:
    """Repair pass used only if a numbered/bulleted list slipped through anyway."""
    system = (
        "Rewrite the given script section as continuous spoken prose. Convert "
        "any numbered list, bulleted list, or lettered list into full "
        "sentences that narrate the same items in flowing language, "
        "preserving all information, all **bold**/*italic* emphasis, and all "
        "`> ` blockquote pause/ask-the-room lines exactly as they are. Do not "
        "add, remove, or reorder any content beyond this reformatting. "
        "Respond with only the rewritten section, no commentary."
    )
    return [{"role": "system", "content": system}, {"role": "user", "content": text}]