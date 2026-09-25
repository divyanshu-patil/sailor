def build_card_batch_prompt(
    full_script: str,
    segments: list[str],
    batch_start_index: int,
    total_segments: int,
    valid_delivery_styles: list[str],
) -> list[dict]:
    """Prompt for ONE batch of cards, not the whole card set. The full script is
    included for impact calibration (so the model can still judge 'how pivotal is
    this relative to the whole talk'), but the model is only ever asked to write
    cards for the specific segments handed to it here — the actual generation
    task stays small and grounded no matter how large card_count gets overall."""
    delivery_options = ", ".join(valid_delivery_styles)
    numbered_segments = "\n\n".join(
        f"--- Segment {batch_start_index + i} of {total_segments} ---\n{segment}"
        for i, segment in enumerate(segments)
    )

    system = (
        "You turn presentation script segments into memory-aid cards for the "
        "presenter. You'll be given the FULL script for context, plus a specific "
        "numbered subset of its segments — produce exactly one card per segment "
        "in that subset, in the order given. Do not produce cards for any other "
        "part of the script, and do not skip or merge any of the given segments.\n\n"
        "For each segment, produce:\n"
        "- title: 2-5 words, punchy, instantly evokes that segment's core idea.\n"
        "- description: one short sentence (roughly 12-20 words) summarizing that "
        "segment — a compact reminder, not a restatement of the script text.\n"
        "- keywords: 3-6 short words or phrases drawn from or inspired by that "
        "segment's actual content — the specific hooks a presenter's eye would "
        "catch to jog their memory of what comes next. Not generic filler words.\n"
        "- impact: a number from 0.00 to 1.00 (two decimals) rating how pivotal or "
        "memorable this segment is relative to the rest of the FULL script above "
        "(not just the segments shown below) — reserve values above 0.8 for "
        "genuinely standout moments (a key statistic, the emotional core, the "
        "call to action), not every card.\n"
        f"- delivery: exactly one of: {delivery_options} — how this segment should "
        "be spoken aloud, based on its content and tone.\n\n"
        f"Respond with ONLY a JSON array of exactly {len(segments)} objects, one "
        "per segment in the order given — no prose before or after, no markdown "
        "code fences, just the raw JSON array."
    )

    user = (
        f"Full script, for context and impact calibration only — do not produce "
        f"cards for parts outside the segments listed below:\n{full_script}\n\n"
        f"Produce cards for these {len(segments)} segments only:\n\n{numbered_segments}"
    )

    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]
