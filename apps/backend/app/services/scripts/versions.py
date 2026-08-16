from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.script_model import ScriptGeneration, ScriptVersion
from app.utils.enums.deck_enums import ScriptVersionKind


def append_version(
    db: Session,
    generation: ScriptGeneration,
    *,
    title: str,
    script: str,
    kind: ScriptVersionKind,
    instruction: str | None = None,
) -> ScriptVersion | None:
    """
    Append a version of a generation's script. Does not commit — the caller owns
    the transaction, so the version and the generation's own denormalised
    title/script land together or not at all.

    A version identical to the current newest is skipped and None returned.
    Re-opening a finished generation re-reads the same script, and without this
    every visit would push another identical entry and fill the undo history with
    steps that change nothing.
    """
    latest = (
        db.query(ScriptVersion)
        .filter(ScriptVersion.generation_id == generation.id)
        .order_by(ScriptVersion.position.desc())
        .first()
    )
    if latest is not None and latest.script == script and latest.title == title:
        return None

    version = ScriptVersion(
        generation_id=generation.id,
        # Derived from the row above rather than a second MAX(position) query:
        # `latest` is already the highest position by definition of its ORDER BY.
        position=(latest.position + 1) if latest is not None else 1,
        title=title,
        script=script,
        kind=kind,
        instruction=instruction,
    )
    db.add(version)
    return version


def version_count(db: Session, generation_id: int) -> int:
    return (
        db.query(func.count(ScriptVersion.id))
        .filter(ScriptVersion.generation_id == generation_id)
        .scalar()
        or 0
    )
