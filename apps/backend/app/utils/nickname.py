"""Nickname validation and canonicalization.

One home for the rules, because three places need them and drift between them
is how a nickname that the app accepted gets rejected by the database, or two
users end up with the same visible nickname.

They are also the *authoritative* rules: the mobile screen validates locally so
it can give instant feedback, but the server re-validates and, more importantly,
owns the uniqueness check. A client-side "available" is a hint, never a promise.
"""

import re
import unicodedata

#: A single character is not a name anyone can tell apart from another, and 7
#: is short enough to sit in a greeting and on a widget. The `users.nickname`
#: column still allows 30, so names saved before the limit keep loading.
NICKNAME_MIN_LENGTH = 2
NICKNAME_MAX_LENGTH = 7

#: Letters and digits from any script, plus the few separators people actually
#: put in a display name. Deliberately permissive rather than ASCII-only: the
#: product is not English-only, and rejecting "José" or "小明" would be a bug.
_ALLOWED = re.compile(r"^[\w.\-']+$", re.UNICODE)
#: Word character that is not an underscore -- i.e. a letter or a digit. A name
#: of only punctuation ("...") is allowed by the pattern above and is not a name.
_HAS_ALNUM = re.compile(r"[^\W_]", re.UNICODE)


class InvalidNickname(ValueError):
    """Raised with a machine-readable ``code`` so callers can answer 422/409
    without parsing the human message."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def collapse_whitespace(raw: str) -> str:
    """Trim the ends and fold internal runs of whitespace to single spaces."""
    return " ".join(raw.strip().split())


def normalize_nickname(raw: str) -> str:
    """The canonical key uniqueness is decided on.

    Case-folded (not merely lower-cased: ``"Straße".casefold() == "strasse"``)
    and whitespace-collapsed, so ``"Alex"``, ``" alex "`` and ``"ALEX"`` are one
    identity. The user's own capitalization is preserved separately in
    ``users.nickname``.
    """
    return collapse_whitespace(raw).casefold()


def validate_nickname(raw: str | None) -> str:
    """Return the display form (trimmed, whitespace-collapsed) or raise.

    Raises :class:`InvalidNickname` with codes ``empty``, ``too_short``,
    ``too_long``, ``invalid_chars`` or ``control_chars``.
    """
    if raw is None:
        raise InvalidNickname("empty", "Please choose a nickname.")

    value = collapse_whitespace(raw)
    if not value:
        raise InvalidNickname("empty", "Please choose a nickname.")
    if any(ch.isspace() for ch in value):
        raise InvalidNickname("invalid_chars", "Nicknames can't have spaces.")
    if len(value) < NICKNAME_MIN_LENGTH:
        raise InvalidNickname(
            "too_short", f"Nicknames need at least {NICKNAME_MIN_LENGTH} characters."
        )
    if len(value) > NICKNAME_MAX_LENGTH:
        raise InvalidNickname(
            "too_long", f"Nicknames can be at most {NICKNAME_MAX_LENGTH} characters."
        )
    if any(unicodedata.category(ch)[0] == "C" for ch in value):
        raise InvalidNickname("control_chars", "That nickname contains invalid characters.")
    if not _ALLOWED.match(value):
        raise InvalidNickname(
            "invalid_chars",
            "Use only letters, numbers, and . ' - _ in your nickname.",
        )
    if not _HAS_ALNUM.search(value):
        raise InvalidNickname("invalid_chars", "That nickname needs a letter or number.")

    return value
