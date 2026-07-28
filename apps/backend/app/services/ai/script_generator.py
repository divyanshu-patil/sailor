import json
import logging
import re

from app.services.ai.chat import ModelCallError, chat, map_parallel
from app.services.ai.prompts import (
    HOOK_TYPES,
    SECTION_SPECS,
    build_continuation_message,
    build_delist_prompt,
    build_plan_prompt,
    build_revision_prompt,
    build_revision_scope_prompt,
    build_section_prompt,
    build_section_revision_prompt,
    section_header,
    section_plan,
    speaking_time,
    total_word_budget,
)
from app.utils.enums.deck_enums import AudienceType

logger = logging.getLogger("celery")

LIST_LINE_PATTERN = re.compile(r"^[ \t]*(\d+[.)]|[-*])[ \t]+", re.MULTILINE)
# The section prompts tell the model not to write a header; this strips one out
# anyway when it ignores that, so a stray "## Opening" can't end up sitting above
# the header the generator adds itself.
LEADING_HEADER_PATTERN = re.compile(r"\A(?:\s*#{1,6}[^\n]*\n+)+")

MIN_ACCEPTABLE_RATIO = 0.9  # a beat within 90% of its target word count is accepted as-is
MAX_CONTINUATION_ATTEMPTS = 2
MAX_DELIST_ATTEMPTS = 1
MAX_PLAN_ATTEMPTS = 2

# Matches the `## [HOOK] · ~30s` headers the generator writes. Capturing the
# label is what lets a revision address one beat by name.
SECTION_HEADER_PATTERN = re.compile(r"^##\s*\[([^\]]+)\][^\n]*$", re.MULTILINE)

# A revised beat shorter than this fraction of the original has dropped content
# rather than edited it. The whole complaint about revisions is that they came
# back drastically compressed, so a beat that fails this check is discarded and
# the original kept — losing the user's requested edit is recoverable, losing
# their script is not.
MIN_REVISION_RETENTION = 0.6
# Number of leading words shown to the routing call to identify a section.
SCOPE_PREVIEW_WORDS = 18


class ScriptGenerationError(Exception):
    """Raised when no configured model could produce a script."""


def _chat(messages: list[dict]) -> str:
    """Single model call, re-raising the shared client's failure as this
    module's error type so callers keep catching one exception."""
    try:
        return chat(messages)
    except ModelCallError as e:
        raise ScriptGenerationError(str(e)) from e


def _repair_lists(text: str) -> str:
    """Catch banned list formatting deterministically rather than trusting the
    negative instruction in the prompt to hold."""
    for _ in range(MAX_DELIST_ATTEMPTS):
        if not LIST_LINE_PATTERN.search(text):
            break
        logger.warning("[ai] list formatting detected, running delist repair")
        text = _chat(build_delist_prompt(text))
    return text


def _strip_json_fences(raw: str) -> str:
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text
        if text.endswith("```"):
            text = text.rsplit("```", 1)[0]
    return text.strip()


# Briefs are written conversationally — "I want to talk about X", "a
# presentation on Y" — so the first four words of one are almost never the
# subject. Stripped before the fallback title is cut out of it.
_BRIEF_PREAMBLE = re.compile(
    r"^\s*(?:i(?:'d| would)? (?:want|like|need) to (?:talk|present|speak|do a talk) "
    r"(?:about|on)|i(?:'m| am) (?:presenting|talking|doing a talk) (?:about|on)|"
    r"(?:this is |it's |its )?(?:a |an |my )?(?:presentation|talk|pitch|deck|speech) "
    r"(?:about|on|regarding)|(?:talk|present|speak) about|about)\s+",
    re.IGNORECASE,
)


def _fallback_title(description: str) -> str:
    """Deterministic fallback used only if the model can't produce a usable
    title after retries — derives something readable from the brief itself
    rather than leaving the deck untitled."""
    first_sentence = _BRIEF_PREAMBLE.sub("", description.strip()).split(".")[0]
    if not first_sentence.split():
        return "Untitled Presentation"
    return _shorten_title(first_sentence)


# Deck titles are rendered on a card in the grid, where anything past about four
# words either wraps to three lines or gets ellipsed — so a long title is never
# actually read. The prompt asks for a short one; this enforces it, because the
# model treats "roughly N words" as a suggestion and drifts long on abstract
# briefs in particular.
MAX_TITLE_WORDS = 4

# Dropped from the front of an over-long title before truncating. A title the
# model padded out reliably starts with one of these, and cutting "The Future
# of Renewable Energy Storage" to "The Future of Renewable" keeps the filler and
# throws away the subject — exactly backwards.
_TITLE_LEAD_FILLER = {
    "a", "an", "the", "how", "why", "what", "when", "understanding",
    "exploring", "introduction", "intro", "overview", "guide", "rethinking",
    "unlocking", "navigating", "mastering", "towards", "toward", "on",
}
_TITLE_JOINERS = {
    "to", "of", "in", "on", "at", "by", "from", "for", "and", "or", "but",
    "with", "into", "over", "under", "your", "our", "their", "its", "a", "an",
    "the", "that", "as",
}


def _shorten_title(raw: str) -> str:
    """Trim a title down to MAX_TITLE_WORDS, keeping the subject rather than the
    run-up to it."""
    cleaned = raw.strip().strip("\"'")
    # A subtitle is the model padding past the limit in a way that word-counting
    # alone handles badly: "Data Debt: The Silent Tax" cut to four words keeps
    # half of each half. The part before the colon is the title.
    cleaned = re.split(r"\s*[:–—]\s+|\s+[-–—]\s+", cleaned, maxsplit=1)[0]
    cleaned = cleaned.rstrip(".!?:;,-–—").strip()
    words = cleaned.split()

    # Strip lead-in words one at a time, but never past the point where the title
    # would be too short to mean anything on its own. Joiners count here as well
    # as at the tail: dropping "How" from "How to Rethink Your Forecasting
    # Process" strands the "to" that belonged to it.
    while len(words) > MAX_TITLE_WORDS and words[0].lower() in (
        _TITLE_LEAD_FILLER | _TITLE_JOINERS
    ):
        words = words[1:]

    if len(words) <= MAX_TITLE_WORDS:
        return " ".join(words) or "Untitled Presentation"

    kept = words[:MAX_TITLE_WORDS]
    # Cutting mid-phrase leaves a dangling connective ("The Cost of") that reads
    # like a truncation bug rather than a title.
    while kept and kept[-1].lower() in _TITLE_JOINERS:
        kept.pop()

    return " ".join(kept) or " ".join(words[:MAX_TITLE_WORDS])


def _fallback_plan(description: str) -> dict:
    """Deterministic plan used only if the model can't produce valid JSON after
    retries — keeps the job alive instead of failing over a parse error. Every
    field is deliberately thin: the section prompts still carry the full beat
    role and tone rules, so a plan this sparse degrades the script's specificity
    without breaking its shape.

    Note: Ollama Cloud does not currently support schema-constrained structured
    outputs, so valid JSON can't be forced at the decoding level and has to be
    handled defensively here."""
    return {
        "title": _fallback_title(description),
        "hook_type": "Question",
        "hook_seed": "",
        "problem": "",
        "core_points": [],
        "proof": "",
        "takeaway": "",
        "extra_insight": "",
    }


def _normalize_plan(plan: dict, description: str) -> dict:
    """Coerce the model's plan into the exact shape the section prompts read.

    Anything missing becomes an empty string/list rather than a KeyError later,
    and hook_type is snapped back onto the menu — the model does occasionally
    invent a seventh hook name, and an unrecognised one would silently drop the
    hook guidance from the opening beat."""
    normalized: dict = {}

    raw_title = (plan.get("title") or "").strip()
    normalized["title"] = (
        _shorten_title(raw_title) if raw_title else _fallback_title(description)
    )
    if raw_title and normalized["title"] != raw_title:
        logger.info(f"[ai] title shortened: '{raw_title}' -> '{normalized['title']}'")

    hook_type = (plan.get("hook_type") or "").strip()
    matched = next((name for name in HOOK_TYPES if name.lower() == hook_type.lower()), None)
    if matched is None and hook_type:
        logger.warning(f"[ai] unrecognised hook_type '{hook_type}', defaulting to Question")
    normalized["hook_type"] = matched or "Question"

    for key in ("hook_seed", "problem", "proof", "takeaway", "extra_insight"):
        value = plan.get(key)
        normalized[key] = (value or "").strip() if isinstance(value, str) else ""

    points = plan.get("core_points") or []
    if isinstance(points, str):
        points = [points]
    normalized["core_points"] = [str(p).strip() for p in points if str(p).strip()][:3]

    return normalized


def _generate_plan(description, duration_mins, audience) -> dict:
    messages = build_plan_prompt(description, duration_mins, audience)
    for attempt in range(MAX_PLAN_ATTEMPTS):
        try:
            raw = _chat(messages)
            plan = json.loads(_strip_json_fences(raw))
            if isinstance(plan, dict) and plan.get("title"):
                return _normalize_plan(plan, description)
            raise ValueError("missing 'title' key")
        except (json.JSONDecodeError, ValueError, ScriptGenerationError) as e:
            logger.warning(f"[ai] plan attempt {attempt} failed: {e}")
            messages.append(
                {
                    "role": "user",
                    "content": (
                        "That was not valid JSON matching the required shape. "
                        "Respond again with ONLY the JSON object, nothing else."
                    ),
                }
            )
    logger.warning("[ai] plan generation failed after retries, using deterministic fallback")
    return _fallback_plan(description)


def _plan_note(key: str, plan: dict) -> str:
    """The slice of the plan a given beat needs, as prompt text.

    Each beat sees only what it's responsible for. Handing every beat the whole
    plan is what makes sections repeat each other — the closing restates the
    problem, the proof re-lists the core points — because the model treats
    everything in context as material it should use."""
    if key == "hook":
        hook_type = plan["hook_type"]
        return (
            f"Hook style to use — {hook_type}: {HOOK_TYPES[hook_type]}\n"
            + (f"Specific opener to write: {plan['hook_seed']}\n" if plan["hook_seed"] else "")
        )
    if key == "problem":
        return f"The problem to establish: {plan['problem']}\n" if plan["problem"] else ""
    if key == "core":
        points = plan["core_points"]
        return "Key points to land: " + "; ".join(points) + ".\n" if points else ""
    if key == "proof":
        return f"Example, case or analogy to tell: {plan['proof']}\n" if plan["proof"] else ""
    if key == "action":
        return f"The action to ask for: {plan['takeaway']}\n" if plan["takeaway"] else ""
    if key == "closing":
        hook_type = plan["hook_type"]
        note = f"Call back to the opening, which was a {hook_type} hook"
        note += f" built on: {plan['hook_seed']}\n" if plan["hook_seed"] else ".\n"
        return note
    return ""


def _generate_section(
    *,
    spec,
    target_words: int,
    title: str,
    audience: AudienceType,
    plan_note: str,
    include_question: bool,
    extra_insight: str | None,
) -> str:
    messages = build_section_prompt(
        spec=spec,
        target_words=target_words,
        title=title,
        audience=audience,
        plan_note=plan_note,
        include_question=include_question,
        extra_insight=extra_insight,
    )
    text = _chat(messages)

    # Undershoot repair: ask the model to continue rather than regenerating from
    # scratch, since LLMs can't reliably self-report word count mid-generation.
    for _ in range(MAX_CONTINUATION_ATTEMPTS):
        current_words = len(text.split())
        if current_words >= MIN_ACCEPTABLE_RATIO * target_words:
            break
        messages.append({"role": "assistant", "content": text})
        messages.append(build_continuation_message(target_words - current_words))
        text = text + "\n\n" + _chat(messages)

    return LEADING_HEADER_PATTERN.sub("", _repair_lists(text)).strip()


def generate_script(description: str, duration_mins: int, audience: AudienceType) -> tuple[str, str]:
    """Returns (generated_title, script).

    Two phases: plan the content once, then write each of the seven fixed beats
    against its own word target. Section headers — the `## [HOOK] · ~30s` lines —
    are written here from each beat's measured word count, never by the model.

    The beats are written concurrently. Nothing about beat N's prompt depends on
    beat N-1's output — every one of them is built from the plan alone, which is
    the entire reason the plan step exists — so running them in sequence made a
    generation cost the sum of seven model latencies instead of the largest one.
    Coherence between beats comes from the shared plan, not from ordering.
    """
    plan = _generate_plan(description, duration_mins, audience)
    title = plan["title"]

    # The beyond-the-brief insight belongs to exactly one beat. PROOF/STORY is
    # where it lands hardest: the audience has just been given a concrete case,
    # so a second-order observation reads as the point of the example rather than
    # a tangent. Threading it into more than one beat makes it sound laboured.
    insight_owner = "proof"

    def write_beat(item: tuple) -> str:
        spec, target_words = item
        body = _generate_section(
            spec=spec,
            target_words=target_words,
            title=title,
            audience=audience,
            plan_note=_plan_note(spec.key, plan),
            include_question=(spec.key == "questions"),
            extra_insight=plan["extra_insight"] if spec.key == insight_owner else None,
        )
        return f"{section_header(spec, len(body.split()))}\n\n{body}"

    # map_parallel preserves input order, which matters: these parts are the
    # script's structure, and a hook that arrives after the closing is not a
    # script.
    parts = map_parallel(write_beat, section_plan(duration_mins))

    script = "\n\n".join(parts)

    total_words = len(script.split())
    logger.info(
        f"[ai] script generated: '{title}' — {total_words} words "
        f"(target ~{total_word_budget(duration_mins)}), "
        f"{len(SECTION_SPECS)} beats, {plan['hook_type']} hook"
    )

    return title, script


def split_sections(script: str) -> list[tuple[str, str, str]]:
    """
    Break a script into (header line, label, body) per beat.

    Returns an empty list for a script with no headers — a manually-written or
    hand-edited one — which is the signal to fall back to whole-script revision.
    Anything before the first header is dropped deliberately: the generator never
    writes a preamble, so text there is a stray the model added.
    """
    matches = list(SECTION_HEADER_PATTERN.finditer(script))
    if not matches:
        return []

    sections: list[tuple[str, str, str]] = []
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(script)
        body = script[match.end() : end].strip()
        sections.append((match.group(0).strip(), match.group(1).strip(), body))
    return sections


def _rebuild_header(original_header: str, label: str, words: int) -> str:
    """Re-time a header from the revised beat's actual word count. The estimate
    is the presenter's rehearsal clock, so a beat that got longer has to say so —
    but only if the original carried a time in the first place."""
    if "·" not in original_header:
        return original_header
    return f"## [{label}] · {speaking_time(words)}"


def _revision_scope(
    instruction: str, sections: list[tuple[str, str, str]]
) -> set[str]:
    """Which beats the instruction touches. Falls back to all of them — the
    previous behaviour — only if the routing call can't be parsed, since
    revising too much is still better than revising nothing."""
    previews = [
        (label, " ".join(body.split()[:SCOPE_PREVIEW_WORDS]) + "…")
        for _, label, body in sections
    ]
    labels = {label for _, label, _ in sections}

    try:
        raw = _chat(build_revision_scope_prompt(instruction=instruction, sections=previews))
        parsed = json.loads(_strip_json_fences(raw))
        chosen = {
            str(name).strip()
            for name in (parsed.get("sections") or [])
            if str(name).strip() in labels
        }
        if chosen:
            return chosen
        logger.warning("[ai] revision scope returned no known sections, revising all")
    except (json.JSONDecodeError, ValueError, AttributeError, ScriptGenerationError) as e:
        logger.warning(f"[ai] revision scope failed ({e}), revising all sections")

    return labels


def revise_script(
    script: str, instruction: str, title: str, audience: AudienceType
) -> str:
    """
    Apply a presenter instruction to an existing script, in place.

    Section-scoped rather than a single whole-script call. Asking a model to
    rewrite a whole script while "changing only what was asked" does not work:
    it regenerates everything and reliably comes back much shorter, because
    "leave this identical" is a negative instruction with no mechanism behind it.
    Here the beats the instruction doesn't touch are never sent to the model at
    all, so they're preserved by construction — the only text that can change is
    text the routing step said should.

    Falls back to the whole-script prompt only for a script with no section
    headers, where there's nothing to scope to.
    """
    sections = split_sections(script)
    original_words = len(script.split())

    if not sections:
        revised = _chat(
            build_revision_prompt(
                script=script, instruction=instruction, title=title, audience=audience
            )
        )
        revised = _repair_lists(revised)
        if len(revised.split()) < MIN_REVISION_RETENTION * original_words:
            logger.warning(
                f"[ai] unstructured revision lost too much content "
                f"({original_words} -> {len(revised.split())} words), keeping original"
            )
            return script
        return revised

    scope = _revision_scope(instruction, sections)
    logger.info(f"[ai] revising {len(scope)}/{len(sections)} sections: {sorted(scope)}")

    def revise_one(section: tuple[str, str, str]) -> str:
        header, label, body = section
        if label not in scope:
            # Untouched, and returned byte-for-byte. This is the guarantee.
            return f"{header}\n\n{body}"

        revised_body = _chat(
            build_section_revision_prompt(
                label=label,
                body=body,
                instruction=instruction,
                title=title,
                audience=audience,
            )
        )
        revised_body = LEADING_HEADER_PATTERN.sub("", _repair_lists(revised_body)).strip()

        before, after = len(body.split()), len(revised_body.split())
        if not revised_body or after < MIN_REVISION_RETENTION * before:
            # The model compressed the beat away instead of editing it. Keeping
            # the original means the instruction didn't land for this beat, which
            # is a far better outcome than handing back a gutted script.
            logger.warning(
                f"[ai] [{label}] revision dropped too much ({before} -> {after} words), "
                "keeping the original section"
            )
            return f"{header}\n\n{body}"

        return f"{_rebuild_header(header, label, after)}\n\n{revised_body}"

    revised = "\n\n".join(map_parallel(revise_one, sections))

    logger.info(
        f"[ai] script revised: '{title}' — {original_words} -> {len(revised.split())} words"
    )

    return revised
