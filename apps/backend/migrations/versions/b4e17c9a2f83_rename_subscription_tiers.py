"""rename subscription tiers to free/pro, drop the unused glykos tier

Revision ID: b4e17c9a2f83
Revises: c8d2f61a904b
Create Date: 2026-09-21

"""
from typing import Sequence, Union

from alembic import op

revision: str = "b4e17c9a2f83"
down_revision: Union[str, Sequence[str], None] = "c8d2f61a904b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Postgres can rename an enum label in place, but it cannot drop one, and this
# migration does both — so the type is rebuilt once and the column carried
# across with a mapping, rather than renaming twice and rebuilding again.
_RENAME = {"sketos": "free", "metrios": "pro"}


def _swap_enum(
    labels: Sequence[str], mapping: dict[str, str], *, default: str
) -> None:
    """Rebuild subscription_tier_enum with exactly `labels`, translating each
    existing value through `mapping` on the way.

    `users.subscription_tier` is the only column of this type — checked against
    information_schema and pg_depend before writing this — so the swap touches
    one column and nothing else has to be rewritten.

    The default is dropped first and restored last: a column default is parsed
    against the type it was written for, and ALTER TYPE ... USING will not run
    while one is still attached.
    """
    quoted = ", ".join(f"'{label}'" for label in labels)
    cases = " ".join(
        f"WHEN '{old}' THEN '{new}'" for old, new in mapping.items()
    )
    op.execute("ALTER TABLE users ALTER COLUMN subscription_tier DROP DEFAULT")
    op.execute(f"CREATE TYPE subscription_tier_enum_new AS ENUM ({quoted})")
    op.execute(
        "ALTER TABLE users"
        " ALTER COLUMN subscription_tier TYPE subscription_tier_enum_new"
        f" USING (CASE subscription_tier::text {cases}"
        "         ELSE subscription_tier::text END)::subscription_tier_enum_new"
    )
    op.execute("DROP TYPE subscription_tier_enum")
    op.execute("ALTER TYPE subscription_tier_enum_new RENAME TO subscription_tier_enum")
    op.execute(
        "ALTER TABLE users ALTER COLUMN subscription_tier"
        f" SET DEFAULT '{default}'::subscription_tier_enum"
    )


def upgrade() -> None:
    """sketos -> free, metrios -> pro, and glykos goes away entirely.

    The Greek coffee scale (sketos/metrios/glykos, plain -> medium -> sweet) was
    a naming conceit that nothing else in the system shared. What this column
    actually caches is a RevenueCat entitlement, there is exactly one of those,
    and it is called "pro" — so the column now says what it means, and matches
    the dashboard, the settings key and the client constant rather than needing
    a translation table to read.

    The two plans behind that entitlement -- Wave (monthly) and Voyager
    (yearly) -- are deliberately NOT tiers. They grant identical access, so a
    tier per plan would be the same row of quota rules written twice, and the
    entitlement payload cannot tell them apart without also reading the product
    identifier. Plan names live where they already worked: the client reads
    them off the store product, so renaming a plan in the dashboard needs no
    migration and no release.

    `glykos` ("team") was never reachable -- no team SKU, no second entitlement,
    no TEAM_MONTHLY_GENERATIONS setting, and the only writer was a local dev
    script. Zero rows held it when this was written; the check below is here
    because "no rows today" is a fact with a shelf life, and this should stop
    cleanly rather than fail halfway through a type swap.

    The default is a separate defect fixed in passing. The model has declared
    `server_default="sketos"` since the column was added, but the database had
    none -- NOT NULL with no default, so the guarantee only ever came from
    SQLAlchemy's Python-side `default=`. Every insert goes through the ORM
    today, so nothing was broken; any write that does not -- raw SQL, a
    dashboard insert, a future service -- would hit a NOT NULL violation on a
    column the model says is safe to omit.
    """
    stale = op.get_bind().exec_driver_sql(
        "SELECT count(*) FROM users WHERE subscription_tier = 'glykos'"
    ).scalar()
    if stale:
        raise RuntimeError(
            f"{stale} user(s) are on the glykos tier; move them to metrios or "
            "sketos before this runs, or they have nowhere to land."
        )

    _swap_enum(("free", "pro"), _RENAME, default="free")


def downgrade() -> None:
    """Back to the Greek names, glykos included.

    Lossless in the direction that matters: every live value maps back, and
    nothing can have been using glykos in between, because the enum this
    migration leaves behind has no such label to assign.
    """
    _swap_enum(
        ("sketos", "metrios", "glykos"),
        {new: old for old, new in _RENAME.items()},
        default="sketos",
    )
