import base64
from datetime import datetime


class InvalidCursorError(ValueError):
    """Raised when a client sends a cursor we can't decode."""


def encode_cursor(sort_value: datetime | int | None, row_id: int) -> str:
    """
    Pack the last row's (sort_value, id) into an opaque token.

    `sort_value` is whatever the current sort orders by — a timestamp for the
    newest-first feed, an integer for most-practised — because the cursor has to
    describe a position *in that order*, not in some canonical one.

    The client should treat this as a black box: round-trip it verbatim, never
    parse it. Base64 is obfuscation-by-convention, not security; nothing
    sensitive lives in a sort key and an id.
    """
    raw = f"{sort_value.isoformat() if isinstance(sort_value, datetime) else sort_value}|{row_id}"
    return base64.urlsafe_b64encode(raw.encode()).decode()


def decode_cursor(cursor: str) -> tuple[str, int]:
    """Returns the sort value as a *string* plus the row id.

    Deliberately untyped on the way out: only the caller knows whether its
    current sort meant a timestamp or a counter, so it does the one cast it
    needs instead of this guessing from the shape of the text.
    """
    try:
        raw = base64.urlsafe_b64decode(cursor.encode()).decode()
        sort_value, id_str = raw.rsplit("|", 1)
        return sort_value, int(id_str)
    except (ValueError, UnicodeDecodeError) as exc:
        raise InvalidCursorError("Malformed pagination cursor") from exc
