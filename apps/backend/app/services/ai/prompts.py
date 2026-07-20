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


def build_script_prompt(title: str, description: str | None, duration_mins: int, audience: AudienceType) -> list[dict]:
    # ~140 words/minute is a natural, unhurried spoken pace
    target_words = duration_mins * 140

    # Scale delivery cues to length so a 3-min script isn't as busy as a 20-min one
    pause_count = max(2, round(duration_mins / 2))
    question_count = max(1, round(duration_mins / 6))

    system = (
        "You are an expert presentation scriptwriter. Write clear, engaging, "
        "spoken-word scripts a presenter can read or paraphrase aloud while "
        "presenting slides.\n\n"
        "OUTPUT FORMAT — Markdown, following these conventions exactly:\n\n"
        "- Continuous spoken prose in short paragraphs. Never slide bullet "
        "points, never a slide-by-slide outline.\n"
        "- Use `## Section Title` headers sparingly, only as private "
        "navigation cues for the presenter (e.g. `## Opening`, `## Close`). "
        "These are never read aloud.\n"
        "- Use **bold** only on the specific word or short phrase the "
        "presenter should vocally stress — a key number, the core claim of "
        "a section. Sparingly, never whole sentences.\n"
        "- Use *italics* for delivery notes and asides not meant to be read "
        "verbatim — a tone cue like *(slow down here)*, or a rhetorical "
        "question posed to the room.\n"
        "- Mark a pause on its own line as a blockquote: `> *(pause)*`. "
        "Place these after a strong statement or right before a shift in "
        "topic — never more than one every couple of minutes.\n"
        "- Mark direct audience engagement as a blockquote: "
        '`> **Ask the room:** "..."` followed by `> *(pause for '
        "responses)*` on the next line. Only where it genuinely fits the "
        "content — not as a gimmick.\n"
        "- No other Markdown: no tables, no numbered/bulleted lists, no "
        "code blocks, no links.\n\n"
        "Example of the expected style:\n\n"
        "## Opening\n"
        "Picture this: **three minutes** before a client call, and the "
        "numbers you were counting on are wrong.\n\n"
        "*(pause)*\n\n"
        "That sinking feeling is exactly why *forecasting discipline* is "
        "our whole talk today.\n\n"
        '> **Ask the room:** "Who\'s had that happen to them?"\n'
        "> *(pause for responses)*\n\n"
        "Tailor vocabulary, tone, pacing, and the kind of examples you "
        "reach for to the stated audience below."
    )

    brief = description or "No additional brief was given — infer a sensible angle and audience from the title alone."
    audience_note = AUDIENCE_GUIDANCE.get(audience, AUDIENCE_GUIDANCE[AudienceType.GENERAL])

    user = (
        f"Write a detailed presentation script.\n\n"
        f"Title: {title}\n"
        f"Brief: {brief}\n"
        f"Audience: {audience.value} — {audience_note}\n"
        f"Target length: approximately {target_words} words "
        f"(~{duration_mins} minutes spoken at a natural pace).\n\n"
        f"Structure: a clear opening hook, a well-organized body that "
        f"develops the topic logically across 2-4 sections, and a strong "
        f"closing line that lands.\n\n"
        f"Include roughly {pause_count} pause cues and {question_count} "
        f"audience-engagement moment(s), spaced naturally through the "
        f"script rather than clustered together. Follow the Markdown "
        f"conventions and example from the system instructions exactly."
    )

    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]