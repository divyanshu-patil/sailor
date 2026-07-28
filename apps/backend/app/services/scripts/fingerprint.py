import hashlib
import re

from app.utils.enums.deck_enums import AudienceType

_WHITESPACE = re.compile(r"\s+")


def brief_fingerprint(
    *, description: str, duration_mins: int, card_count: int, audience: AudienceType
) -> str:
    """
    Stable hash of everything that would change the generated script.

    This is what makes "tap Generate again without changing anything" free. The
    old flow started a fresh job — and created a fresh deck — on every tap, so
    walking back from the preview screen and forward again discarded a perfectly
    good script and paid to generate it a second time. With a fingerprint, the
    same brief resolves to the generation that's already running or already
    finished.

    Normalisation is deliberately aggressive on `description` only: leading and
    trailing space, collapsed runs of whitespace and case are all things a user
    changes by accident while re-reading their own brief, and none of them are
    worth a second generation. The numbers and the audience are matched exactly,
    since changing any of them genuinely changes the output.
    """
    normalized_description = _WHITESPACE.sub(" ", description).strip().casefold()
    # NUL as the separator, not a printable character: a description can contain
    # any punctuation a user can type, and a separator they can type is one they
    # can use to make two different briefs hash the same.
    payload = "\x00".join(
        [
            normalized_description,
            str(duration_mins),
            str(card_count),
            audience.value,
        ]
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()
