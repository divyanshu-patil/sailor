"""The onboarding demo: the stored file, the picker's ordering, the public
endpoints, and the shaping the generator script applies to pipeline output.

The endpoints are exercised on a bare FastAPI app with only this router, so the
tests need no database, no auth and no AI provider — which is the whole point
of the demo being public and precomputed.
"""

import json
import unittest
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1 import onboarding_demo_router
from app.schemas.onboarding_demo_schema import DemoDetail
from app.services import onboarding_demos
from app.services.onboarding_demos import CATALOG, DemoBrief, build_demo, list_options


def client() -> TestClient:
    app = FastAPI()
    app.include_router(onboarding_demo_router.router, prefix="/api/v1")
    return TestClient(app)


class StoredDemoTests(unittest.TestCase):
    def test_every_catalog_brief_is_stored_and_valid(self):
        stored = {demo["id"]: demo for demo in onboarding_demos.load_demos()}
        self.assertEqual(set(stored), {brief.id for brief in CATALOG})
        for brief in CATALOG:
            demo = DemoDetail.model_validate(stored[brief.id])
            self.assertEqual(demo.context, brief.context)
            self.assertEqual(demo.brief, brief.brief)
            self.assertEqual(demo.audience, brief.audience)
            self.assertEqual(demo.mood, brief.mood)
            self.assertEqual(demo.profession, brief.profession)
            self.assertGreater(len(demo.script.split()), 100)
            self.assertEqual(len(demo.deck.cards), demo.cardCount)
            self.assertEqual(
                [card.position for card in demo.deck.cards],
                list(range(1, demo.cardCount + 1)),
            )

    def test_stored_audiences_are_ones_the_app_can_show(self):
        # The app's audience dial (AUDIENCE_OPTIONS) has these six. A demo made
        # for any other audience couldn't preset the dial to what it used.
        shown = {"general", "executives", "students", "technical", "business", "investors"}
        for demo in onboarding_demos.load_demos():
            self.assertIn(demo["audience"], shown, demo["id"])

    def test_every_context_has_two_demos(self):
        for context in onboarding_demos.CONTEXTS:
            self.assertEqual(
                sum(1 for brief in CATALOG if brief.context == context), 2, context
            )


class ListOptionsTests(unittest.TestCase):
    def test_round_robin_across_the_chosen_contexts(self):
        options = list_options(["work", "interviews"], limit=4)
        self.assertEqual(
            [o["context"] for o in options], ["work", "interviews", "work", "interviews"]
        )

    def test_fills_from_the_rest_of_the_catalog(self):
        options = list_options(["english"], limit=4)
        self.assertEqual([o["context"] for o in options[:2]], ["english", "english"])
        self.assertEqual(len(options), 4)
        self.assertNotIn("english", {o["context"] for o in options[2:]})

    def test_unknown_and_duplicate_contexts_are_ignored(self):
        self.assertEqual(
            list_options(["nope", "college", "college"], limit=2),
            list_options(["college"], limit=2),
        )

    def test_no_contexts_means_catalog_order(self):
        options = list_options([], limit=3)
        self.assertEqual([o["id"] for o in options], [b.id for b in CATALOG[:3]])

    def test_limit_is_at_least_one(self):
        self.assertEqual(len(list_options([], limit=0)), 1)

    def test_options_carry_no_script(self):
        for option in list_options([], limit=12):
            self.assertNotIn("script", option)
            self.assertNotIn("deck", option)


class EndpointTests(unittest.TestCase):
    def test_list_is_public_and_cacheable(self):
        response = client().get("/api/v1/onboarding-demos?contexts=work,%20everyday&limit=3")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["cache-control"], "public, max-age=86400")
        self.assertEqual(
            [o["context"] for o in response.json()], ["work", "everyday", "work"]
        )

    def test_list_defaults(self):
        response = client().get("/api/v1/onboarding-demos")
        self.assertEqual(len(response.json()), onboarding_demos.DEFAULT_LIMIT)

    def test_list_rejects_an_out_of_range_limit(self):
        self.assertEqual(client().get("/api/v1/onboarding-demos?limit=99").status_code, 422)

    def test_detail(self):
        response = client().get("/api/v1/onboarding-demos/work-new-idea")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["cache-control"], "public, max-age=86400")
        body = response.json()
        self.assertEqual(body["id"], "work-new-idea")
        self.assertTrue(body["script"])
        self.assertEqual(len(body["deck"]["cards"]), body["cardCount"])

    def test_unknown_demo_is_404(self):
        response = client().get("/api/v1/onboarding-demos/nope")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"detail": "Demo not found"})


class BuildDemoTests(unittest.TestCase):
    def test_shapes_pipeline_output_and_colours_by_impact(self):
        brief: DemoBrief = CATALOG[0]
        calls = {}

        def fake_script(**kwargs):
            calls["script"] = kwargs
            return "Title", "Body of the script"

        def fake_cards(script, count):
            calls["cards"] = (script, count)
            return [
                {"title": "A", "description": "a", "keywords": ["k"], "impact": 0.2, "delivery": "calm"},
                {"title": "B", "description": "b", "keywords": [], "impact": 0.9, "delivery": "energetic"},
            ]

        def fake_colors(cards):
            for card in cards:
                card.color = "#HIGH" if card.impact > 0.5 else "#LOW"

        demo = build_demo(brief, "#F4D35E", fake_script, fake_cards, fake_colors)

        self.assertEqual(
            calls["script"],
            {
                "description": brief.brief,
                "duration_mins": brief.duration_mins,
                "audience": brief.audience,
                "mood": brief.mood,
                "profession": brief.profession,
            },
        )
        self.assertEqual(calls["cards"], ("Body of the script", brief.card_count))
        self.assertEqual(demo["cardCount"], 2)
        self.assertEqual(demo["deck"]["color"], "#F4D35E")
        self.assertEqual([c["color"] for c in demo["deck"]["cards"]], ["#LOW", "#HIGH"])
        self.assertEqual([c["position"] for c in demo["deck"]["cards"]], [1, 2])
        DemoDetail.model_validate(demo)
        # Round-trips through JSON, which is how it is stored.
        self.assertEqual(json.loads(json.dumps(demo)), demo)

    def test_real_colour_pass_works_on_plain_objects(self):
        # The generator script hands the real Card colouring function objects
        # that merely look like Card rows.
        from app.services.cards.impact_colors import assign_colors_by_impact

        cards = [SimpleNamespace(impact=i / 10, color="") for i in range(5)]
        assign_colors_by_impact(cards)
        self.assertTrue(all(card.color.startswith("#") for card in cards))


if __name__ == "__main__":
    unittest.main()
