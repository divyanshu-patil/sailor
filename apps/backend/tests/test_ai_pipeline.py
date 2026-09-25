"""Card generation, script generation, the AI output schemas and the prompt
builders — with `chat` replaced, so no model is called."""

import json

import pytest
from pydantic import ValidationError

from app.schemas import ai_schema
from app.services.ai import card_generator, prompts, script_generator
from app.services.ai.card_prompt import build_card_batch_prompt
from app.services.ai.chat import ModelCallError
from app.utils.enums.deck_enums import AudienceType
from app.utils.enums.speaking_style import SpeakingStyle
from app.utils.enums.user_enums import ExperienceLevel, Profession, ScriptMood

VALID = {s.value for s in SpeakingStyle}
SCRIPT = "One two three four. Five six seven. Eight nine ten eleven. Twelve thirteen."


def card(title="T", **extra):
    return {"title": title, "description": "D", "keywords": ["k"], "impact": 0.7, "delivery": "confident", **extra}


class TestSegments:
    def test_splits_evenly_by_words(self):
        segments = card_generator.split_script_into_segments(SCRIPT, 2)
        assert len(segments) == 2
        assert " ".join(segments).split() == SCRIPT.split()

    def test_refuses_more_cards_than_sentences(self):
        with pytest.raises(card_generator.CardGenerationError):
            card_generator.split_script_into_segments("Just one.", 3)

    def test_digest_keeps_short_scripts_and_condenses_long_ones(self, monkeypatch):
        assert card_generator._script_digest("short") == "short"
        monkeypatch.setattr(card_generator, "MAX_CALIBRATION_CHARS", 60)
        long = "## [HOOK]\n\nFirst sentence here. More detail follows.\n\n\n\nSecond block starts. And goes on."
        digest = card_generator._script_digest(long)
        assert "## [HOOK]" in digest and "More detail" not in digest
        monkeypatch.setattr(card_generator, "MAX_CALIBRATION_CHARS", 10)
        assert "[...]" in card_generator._script_digest(long)


class TestCardParsing:
    def test_extracts_the_json_array(self):
        assert card_generator._extract_json_array('noise [1, 2] tail') == "[1, 2]"
        for bad in ("no array", "] backwards ["):
            with pytest.raises(card_generator.CardGenerationError):
                card_generator._extract_json_array(bad)

    def test_coerces_and_repairs_cards(self):
        coerce = lambda item: card_generator._coerce_card(item, VALID)
        assert coerce("not a dict") is None
        assert coerce({}) is None
        assert coerce({"description": "only a description here"})["title"] == "only a description here"
        assert coerce({"title": "Only title"})["description"] == "Only title"
        repaired = coerce({"title": "T", "description": "D", "keywords": "one", "impact": "high", "delivery": "explanatory"})
        assert repaired["keywords"] == ["one"]
        assert repaired["impact"] == card_generator.DEFAULT_IMPACT
        assert repaired["delivery"] in VALID
        assert coerce({"title": "T", "keywords": 5, "impact": 7, "delivery": ""})["impact"] == 1.0
        assert coerce({"title": "T", "delivery": "zzzzzz"})["delivery"] == card_generator.DEFAULT_DELIVERY

    def test_coerce_batch(self):
        with pytest.raises(card_generator.CardGenerationError):
            card_generator._coerce_cards({"not": "a list"}, VALID)
        assert len(card_generator._coerce_cards([card(), None, {}], VALID)) == 1

    def test_card_from_segment(self):
        built = card_generator._card_from_segment("The quarterly revenue numbers improved dramatically. Then more.")
        assert built["title"] == "quarterly revenue numbers improved"
        assert card_generator._card_from_segment("A b c d e.")["title"] == "A b c d"
        assert card_generator._card_from_segment("   ")["title"] == "Untitled Card"
        long = card_generator._card_from_segment("word " * 60)
        assert long["description"].endswith("...")

    def test_card_filtered_to_nothing_falls_back(self, monkeypatch):
        # Every "salient" word filtered and no text: the fallback description.
        monkeypatch.setattr(card_generator, "_SENTENCE_SPLIT_PATTERN", card_generator.re.compile(r"$^"))
        assert card_generator._card_from_segment("")["description"] == "This part of the script."


class TestCardBatches:
    def test_first_answer_accepted_and_extras_trimmed(self, monkeypatch):
        monkeypatch.setattr(card_generator, "chat", lambda messages: json.dumps([card("A"), card("B"), card("C")]))
        cards = card_generator._generate_card_batch("s", ["x.", "y."], 1, 2, VALID)
        assert [c["title"] for c in cards] == ["A", "B"]

    def test_short_answer_is_retried_then_filled_from_the_text(self, monkeypatch):
        answers = iter(["garbage", json.dumps([card("A")])])
        monkeypatch.setattr(card_generator, "chat", lambda messages: next(answers))
        cards = card_generator._generate_card_batch("s", ["First segment here.", "Second segment here."], 1, 2, VALID)
        assert cards[0]["title"] == "A"
        assert cards[1]["impact"] == card_generator.DEFAULT_IMPACT

    def test_retry_succeeds(self, monkeypatch):
        answers = iter([json.dumps([card("A")]), json.dumps([card("A"), card("B")])])
        seen = []

        def chat(messages):
            seen.append(len(messages))
            return next(answers)

        monkeypatch.setattr(card_generator, "chat", chat)
        assert len(card_generator._generate_card_batch("s", ["x.", "y."], 1, 2, VALID)) == 2
        assert seen[1] == seen[0] + 2

    def test_model_failure_is_fatal(self, monkeypatch):
        def chat(messages):
            raise ModelCallError("all down")

        monkeypatch.setattr(card_generator, "chat", chat)
        with pytest.raises(card_generator.CardGenerationError):
            card_generator._generate_card_batch("s", ["x."], 1, 1, VALID)

    def test_generate_cards_runs_batches(self, monkeypatch):
        monkeypatch.setattr(card_generator, "CARD_BATCH_SIZE", 1)
        monkeypatch.setattr(card_generator, "chat", lambda messages: json.dumps([card()]))
        monkeypatch.setattr(card_generator, "MAX_CALIBRATION_CHARS", 10)
        assert len(card_generator.generate_cards(SCRIPT, 3)) == 3

    def test_card_prompt(self):
        messages = build_card_batch_prompt("script", ["a.", "b."], 1, 2, sorted(VALID))
        assert messages and "a." in json.dumps(messages)


class TestScriptGenerator:
    def test_titles(self):
        assert script_generator._shorten_title('"Big Ideas: A Primer"') == "Big Ideas"
        assert script_generator._shorten_title("Why small habits beat big goals") == "Why small habits beat"
        assert script_generator._shorten_title("The art of the") == "The art of the"
        assert script_generator._shorten_title("Winning big in the end") == "Winning big"
        assert script_generator._shorten_title("of of of of of") == "of of of of"
        assert script_generator._shorten_title("...") == "Untitled Presentation"
        assert script_generator._fallback_title("I want to talk about compounding habits. More.") == "compounding habits"
        assert script_generator._fallback_title("   ") == "Untitled Presentation"

    def test_split_title(self):
        title, script = script_generator._split_title("TITLE: Small Wins\n\nBody text.", "brief")
        assert title == "Small Wins" and script == "Body text."
        title, script = script_generator._split_title("No title here.", "A talk about habits.")
        assert title == "habits" and script == "No title here."

    def test_generate_and_revise(self, monkeypatch):
        monkeypatch.setattr(script_generator, "chat", lambda messages, images=(): "TITLE: Small Wins\n\n" + "word " * 50)
        title, script = script_generator.generate_script(
            "A talk about habits.", 2, AudienceType.GENERAL,
            mood=ScriptMood.CALM, profession=Profession.TECH, experience_level=ExperienceLevel.BEGINNER,
        )
        assert title == "Small Wins" and script.startswith("word")
        revised = script_generator.revise_script(
            "word " * 50, "tighten", "Small Wins", AudienceType.GENERAL, source_text="notes", links="https://x.y",
        )
        assert revised.startswith("TITLE")

    def test_revision_that_guts_the_script_is_refused(self, monkeypatch):
        monkeypatch.setattr(script_generator, "chat", lambda messages, images=(): "tiny")
        with pytest.raises(script_generator.ScriptGenerationError):
            script_generator.revise_script("word " * 100, "x", "t", AudienceType.GENERAL)

    def test_model_failure(self, monkeypatch):
        def chat(messages, images=()):
            raise ModelCallError("down")

        monkeypatch.setattr(script_generator, "chat", chat)
        with pytest.raises(script_generator.ScriptGenerationError):
            script_generator.generate_script("A talk about habits.", 1, AudienceType.GENERAL)


class TestSchemas:
    def test_normalize_delivery(self):
        assert ai_schema.normalize_delivery("Storytelling") == "storytelling"
        assert ai_schema.normalize_delivery("enthusiastic") == "energetic"
        assert ai_schema.normalize_delivery("confidnt") == "confident"
        assert ai_schema.normalize_delivery("???") == SpeakingStyle.EXPLAINING.value

    def test_output_models(self):
        good = {"title": "T", "description": "D", "color": "#abcdef", "impact": 0.5, "delivery": "enthusiastic"}
        parsed = ai_schema.AICardOutput(**good)
        assert parsed.color == "#ABCDEF" and parsed.delivery == SpeakingStyle.ENERGETIC
        assert ai_schema.AICardOutput(**{**good, "delivery": "calm"}).delivery.value == "calm"
        with pytest.raises(ValidationError):
            ai_schema.AICardOutput(**{**good, "color": "red"})
        assert ai_schema.AIDeckScriptOutput(title="T", script="S", color="#000000").color == "#000000"
        with pytest.raises(ValidationError):
            ai_schema.AIDeckScriptOutput(title="T", script="S", color="nope")
        assert len(ai_schema.AICardBatchOutput(cards=[good]).cards) == 1

        slide = {
            "cardNumber": 1, "title": "T", "speakerNotes": "N", "slideContent": ["a"],
            "estimatedWordCount": 10, "estimatedDurationSeconds": 5, "impact": 0.5,
            "delivery": "zany", "color": "#123456",
        }
        presentation = ai_schema.AIGeneratedPresentationOutput(cards=[slide])
        assert presentation.color is None
        assert ai_schema.AIGeneratedPresentationOutput(color="#aaaaaa", cards=[{**slide, "delivery": "calm"}]).color == "#AAAAAA"
        with pytest.raises(ValidationError):
            ai_schema.AIGeneratedPresentationOutput(color="x", cards=[slide])
        with pytest.raises(ValidationError):
            ai_schema.AIGeneratedPresentationCardOutput(**{**slide, "color": "x"})
        deck = ai_schema.AIDeckOutput(title="T", script="S", color="#bbbbbb", cards=[good])
        assert deck.color == "#BBBBBB"
        with pytest.raises(ValidationError):
            ai_schema.AIDeckOutput(title="T", script="S", color="x", cards=[])


class TestPrompts:
    def test_budgets_and_plans(self):
        for minutes in (1, 3, 10, 30, 60):
            assert prompts.total_word_budget(minutes) > 0
            plan = prompts.section_plan(minutes)
            assert plan and all(words > 0 for _, words in plan)
            spec, words = plan[0]
            assert prompts.section_header(spec, words)
        assert prompts.speaking_time(30) and prompts.speaking_time(400)

    def test_blocks(self):
        assert prompts.reference_links_block(None) == ""
        assert "https://a.b" in prompts.reference_links_block("https://a.b\nhttps://c.d")
        assert prompts.source_material_block(None) == ""
        assert prompts.source_material_block("x" * 200_000)
        assert prompts.speaker_profile_block(None, None, None) == "" or isinstance(prompts.speaker_profile_block(None, None, None), str)
        assert prompts.speaker_profile_block(ScriptMood.PLAYFUL, Profession.ACADEMIC, ExperienceLevel.ADVANCED)

    def test_builders(self):
        args = dict(mood=ScriptMood.CALM, profession=Profession.TECH, experience=ExperienceLevel.BEGINNER)
        for audience in AudienceType:
            assert prompts.build_whole_script_prompt("brief", 3, audience, source_text="notes", links="https://a.b", **args)
        assert prompts.build_revision_prompt(script="s " * 50, instruction="i", title="t", audience=AudienceType.GENERAL, **args)
        assert prompts.build_continuation_message(120)["content"]
        assert prompts.build_delist_prompt("- a\n- b")
