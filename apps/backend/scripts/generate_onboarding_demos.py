"""
(Re)generate the onboarding demos.

    uv run python -m scripts.generate_onboarding_demos           # all of them
    uv run python -m scripts.generate_onboarding_demos work-new-idea ...

Runs every brief in app/services/onboarding_demos.CATALOG through the real
script and card pipeline, with whatever AI provider .env configures, and writes
app/data/onboarding_demos.json. The API only ever reads that file — run this
when the catalogue or the prompts change, review the diff, and commit it.

Passing ids regenerates just those and keeps the rest of the file as it is.
"""

import json
import logging
import sys
from concurrent.futures import ThreadPoolExecutor

from app.services.ai.card_generator import generate_cards
from app.services.ai.script_generator import generate_script
from app.services.cards.impact_colors import assign_colors_by_impact
from app.services.onboarding_demos import (
    CATALOG,
    DATA_PATH,
    DEMO_DECK_COLORS,
    build_demo,
)

logging.basicConfig(level=logging.INFO, format="%(message)s")
log = logging.getLogger("onboarding-demos")


def main(only: list[str]) -> None:
    existing: dict[str, dict] = {}
    if only and DATA_PATH.exists():
        existing = {d["id"]: d for d in json.loads(DATA_PATH.read_text())}

    targets = [b for b in CATALOG if not only or b.id in only]
    unknown = set(only) - {b.id for b in CATALOG}
    if unknown:
        raise SystemExit(f"Unknown demo ids: {', '.join(sorted(unknown))}")

    def build(index_and_brief):
        index, brief = index_and_brief
        color = DEMO_DECK_COLORS[index % len(DEMO_DECK_COLORS)]
        log.info(f"→ {brief.id}")
        demo = build_demo(
            brief,
            color,
            generate_script=generate_script,
            generate_cards=generate_cards,
            assign_colors=assign_colors_by_impact,
        )
        log.info(f"✓ {brief.id}: {demo['title']!r}, {demo['cardCount']} cards")
        return demo

    indexed = [(CATALOG.index(b), b) for b in targets]
    with ThreadPoolExecutor(max_workers=3) as pool:
        for demo in pool.map(build, indexed):
            existing[demo["id"]] = demo

    ordered = [existing[b.id] for b in CATALOG if b.id in existing]
    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    DATA_PATH.write_text(json.dumps(ordered, indent=2, ensure_ascii=False) + "\n")
    log.info(f"Wrote {len(ordered)} demos to {DATA_PATH}")


if __name__ == "__main__":
    main(sys.argv[1:])
