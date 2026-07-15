import json
import unittest

from app.schemas.deck_schema import DeckGenerateRequest
from app.services.ai.presentation_math import (
    calculateTargetWords,
    calculateWordsPerCard,
    countWords,
    getWordsPerMinute,
)
from app.services.deck_generation_service import DeckGenerationService


def _make_word_sequence(prefix: str, count: int) -> str:
    return " ".join(f"{prefix}{index}" for index in range(1, count + 1))


def _make_presentation_response(title: str, cards: list[dict], color: str = "#3366FF"):
    return json.dumps({"title": title, "color": color, "cards": cards})


def _make_card(card_number: int, word_count: int, *, title_prefix: str = "Card"):
    notes = _make_word_sequence(f"{title_prefix.lower()}{card_number}_", word_count)
    return {
        "cardNumber": card_number,
        "title": f"{title_prefix} {card_number}",
        "speakerNotes": notes,
        "slideContent": [f"{title_prefix} {card_number} slide point"],
        "estimatedWordCount": word_count,
        "estimatedDurationSeconds": max(1, word_count // 2),
        "impact": 0.8,
        "delivery": "confident",
        "color": "#3366FF",
    }


class FakeAIClient:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    def generate_json(self, *, system_prompt: str, user_prompt: str, temperature: float = 0.7, max_tokens=None) -> str:
        self.calls.append(
            {
                "system_prompt": system_prompt,
                "user_prompt": user_prompt,
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
        )
        if not self.responses:
            raise AssertionError("FakeAIClient ran out of responses")
        return self.responses.pop(0)


class DeckGenerationServiceTests(unittest.TestCase):
    def _build_request(self, *, duration_minutes: int = 1, audience_index: int = 2, card_count: int = 2) -> DeckGenerateRequest:
        return DeckGenerateRequest.model_validate(
            {
                "description": "Explain how I/O architecture works in a professional presentation.",
                "durationMinutes": duration_minutes,
                "audienceIndex": audience_index,
                "cardCount": card_count,
                "attachments": [],
            }
        )

    def test_length_helpers_use_audience_specific_speaking_rates(self):
        self.assertEqual(getWordsPerMinute(0), 135)
        self.assertEqual(getWordsPerMinute(2), 145)
        self.assertEqual(calculateTargetWords(20, 2), 2900)
        self.assertEqual(calculateTargetWords(20, 1), 2300)
        self.assertEqual(calculateWordsPerCard(2900, 20), 145)
        self.assertEqual(countWords("one two   three"), 3)

    def test_generate_uses_cards_as_the_source_of_truth(self):
        first_card_notes = _make_word_sequence("student_one_", 80)
        second_card_notes = _make_word_sequence("student_two_", 80)
        fake_client = FakeAIClient(
            [
                _make_presentation_response(
                    "Why this presentation matters",
                    [
                        _make_card(1, 80, title_prefix="Card"),
                        _make_card(2, 80, title_prefix="Card"),
                    ],
                )
            ]
        )

        # Replace the auto-generated notes with deterministic content for the assertions.
        fake_client.responses[0] = _make_presentation_response(
            "Why this presentation matters",
            [
                {
                    **_make_card(1, 80),
                    "speakerNotes": first_card_notes,
                },
                {
                    **_make_card(2, 80),
                    "speakerNotes": second_card_notes,
                },
            ],
        )

        service = DeckGenerationService(ai_client=fake_client)
        output = service.generate(self._build_request())

        self.assertEqual(output.title, "Why this presentation matters")
        self.assertEqual(output.color, "#3366FF")
        self.assertEqual(len(output.cards), 2)
        self.assertTrue(output.cards[0].description.startswith("student_one_1"))
        self.assertTrue(output.cards[1].description.startswith("student_two_1"))
        self.assertLessEqual(len(output.cards[0].description), 500)
        self.assertLessEqual(len(output.cards[1].description), 500)
        self.assertEqual(output.script, f"{first_card_notes} {second_card_notes}")
        self.assertEqual(countWords(output.script), 160)
        self.assertEqual(len(fake_client.calls), 1)
        self.assertIn("Generate approximately 145 spoken words.", fake_client.calls[0]["user_prompt"])
        self.assertIn("Assume a speaking speed of 145 words per minute.", fake_client.calls[0]["user_prompt"])
        self.assertIn("Generate EXACTLY 2 presentation cards.", fake_client.calls[0]["user_prompt"])
        self.assertIn("Each card should contain approximately 73 spoken words.", fake_client.calls[0]["user_prompt"])
        self.assertIn("create an internal outline", fake_client.calls[0]["user_prompt"].lower())

    def test_generate_retries_invalid_presentation_without_reexpanding(self):
        valid_response = _make_presentation_response(
            "Why this presentation matters",
            [
                {
                    **_make_card(1, 140),
                    "speakerNotes": _make_word_sequence("valid_card_", 140),
                }
            ],
        )
        fake_client = FakeAIClient([
            "{not valid json",
            valid_response,
        ])

        service = DeckGenerationService(ai_client=fake_client)
        output = service.generate(self._build_request(duration_minutes=1, audience_index=0, card_count=1))

        self.assertEqual(len(output.cards), 1)
        self.assertEqual(len(fake_client.calls), 2)
        self.assertIn("previous presentation response was invalid", fake_client.calls[1]["user_prompt"].lower())
        self.assertNotIn("current presentation is too short", fake_client.calls[1]["user_prompt"].lower())
        self.assertTrue(output.cards[0].description.startswith("valid_card_1"))

    def test_generate_expands_when_script_is_too_short(self):
        short_response = _make_presentation_response(
            "Why this presentation matters",
            [
                {
                    **_make_card(1, 10),
                    "speakerNotes": _make_word_sequence("short_card_1_", 10),
                },
                {
                    **_make_card(2, 10),
                    "speakerNotes": _make_word_sequence("short_card_2_", 10),
                },
            ],
        )
        expanded_response = _make_presentation_response(
            "Why this presentation matters",
            [
                {
                    **_make_card(1, 80),
                    "speakerNotes": _make_word_sequence("expanded_card_1_", 80),
                },
                {
                    **_make_card(2, 80),
                    "speakerNotes": _make_word_sequence("expanded_card_2_", 80),
                },
            ],
        )
        fake_client = FakeAIClient([short_response, expanded_response])

        service = DeckGenerationService(ai_client=fake_client)
        output = service.generate(self._build_request())

        self.assertEqual(len(fake_client.calls), 2)
        self.assertIn("the current presentation is too short", fake_client.calls[1]["user_prompt"].lower())
        self.assertIn("preserve all existing content", fake_client.calls[1]["user_prompt"].lower())
        self.assertTrue(output.cards[0].description.startswith("expanded_card_1_1"))
        self.assertTrue(output.cards[1].description.startswith("expanded_card_2_1"))
        self.assertEqual(countWords(output.script), 160)

    def test_generate_merges_short_expansion_responses_without_failing(self):
        initial_cards = [
            {
                **_make_card(index, 8, title_prefix="Initial"),
                "speakerNotes": _make_word_sequence(f"initial_card_{index}_", 8),
            }
            for index in range(1, 12)
        ]
        missing_cards = [
            {
                **_make_card(index, 8, title_prefix="Missing"),
                "speakerNotes": _make_word_sequence(f"missing_card_{index}_", 8),
            }
            for index in range(12, 16)
        ]
        expanded_cards = [
            {
                **_make_card(index, 80, title_prefix="Expanded"),
                "speakerNotes": _make_word_sequence(f"expanded_card_{index}_", 80),
            }
            for index in range(1, 12)
        ]
        fake_client = FakeAIClient(
            [
                _make_presentation_response("Initial Deck", initial_cards),
                _make_presentation_response("Missing Deck", missing_cards),
                _make_presentation_response("Expanded Deck", expanded_cards),
            ]
        )

        service = DeckGenerationService(ai_client=fake_client)
        output = service.generate(self._build_request(card_count=15))

        self.assertEqual(len(fake_client.calls), 3)
        self.assertEqual(len(output.cards), 15)
        self.assertTrue(output.cards[0].description.startswith("expanded_card_1_1"))
        self.assertTrue(output.cards[10].description.startswith("expanded_card_11_1"))
        self.assertTrue(output.cards[11].description.startswith("missing_card_12_1"))
        self.assertEqual(countWords(output.script), 912)

    def test_generate_derives_title_and_color_when_ai_omits_them(self):
        response_without_title_or_color = json.dumps(
            {
                "cards": [
                    {
                        **_make_card(1, 80),
                        "speakerNotes": _make_word_sequence("fallback_card_1_", 80),
                    },
                    {
                        **_make_card(2, 80),
                        "speakerNotes": _make_word_sequence("fallback_card_2_", 80),
                    },
                ]
            }
        )
        fake_client = FakeAIClient([response_without_title_or_color])

        service = DeckGenerationService(ai_client=fake_client)
        output = service.generate(self._build_request())

        self.assertEqual(output.title, "Card 1")
        self.assertEqual(output.color, "#3366FF")
        self.assertEqual(len(output.cards), 2)
        self.assertEqual(countWords(output.script), 160)

    def test_generate_completes_missing_cards_when_initial_response_is_short(self):
        initial_cards = [
            _make_card(index, 10, title_prefix="Initial")
            for index in range(1, 10)
        ]
        missing_cards = [
            _make_card(index, 10, title_prefix="Missing")
            for index in range(10, 16)
        ]
        fake_client = FakeAIClient(
            [
                _make_presentation_response("Initial Deck", initial_cards),
                _make_presentation_response("Missing Deck", missing_cards),
            ]
        )

        service = DeckGenerationService(ai_client=fake_client)
        output = service.generate(self._build_request(card_count=15))

        self.assertEqual(len(fake_client.calls), 2)
        self.assertIn("Generate EXACTLY 15 presentation cards.", fake_client.calls[0]["user_prompt"])
        self.assertIn("cards 10-15", fake_client.calls[1]["user_prompt"])
        self.assertEqual(len(output.cards), 15)
        self.assertEqual([card.title for card in output.cards], [f"Initial {index}" for index in range(1, 10)] + [f"Missing {index}" for index in range(10, 16)])


if __name__ == "__main__":
    unittest.main()