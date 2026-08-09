import base64
from datetime import datetime


class InvalidCursorError(ValueError):
    """Raised when a client sends a cursor we can't decode."""


def encode_cursor(created_at: datetime, row_id: int) -> str:
    """
    Pack the last row's (created_at, id) into an opaque token.

    The client should treat this as a black box — round-trip it verbatim,
    never parse it. Base64 is just obfuscation-by-convention here, not
    security; nothing sensitive lives in a created_at/id pair.
    """
    raw = f"{created_at.isoformat()}|{row_id}"
    return base64.urlsafe_b64encode(raw.encode()).decode()


def decode_cursor(cursor: str) -> tuple[datetime, int]:
    try:
        raw = base64.urlsafe_b64decode(cursor.encode()).decode()
        created_at_str, id_str = raw.split("|")
        return datetime.fromisoformat(created_at_str), int(id_str)
    except (ValueError, UnicodeDecodeError) as exc:
        raise InvalidCursorError("Malformed pagination cursor") from exc