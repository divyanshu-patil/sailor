import json
import logging
from typing import Optional

from pydantic import ValidationError

from app.config.settings import settings
from app.core.exceptions import AIGenerationError, AIResponseParsingError
from app.schemas.ai_schema import AICardOutput, AIDeckOutput, AIGeneratedPresentationOutput
from app.schemas.deck_schema import DeckGenerateRequest
from app.services.ai.client import AIClient
from app.services.ai.presentation_math import buildScriptFromCards, calculateTargetWords, validatePresentationLength
from app.services.ai.prompts import (
    build_card_batch_user_prompt,
    build_card_expansion_user_prompt,
    build_card_generation_user_prompt,
    build_card_system_prompt,
)

logger = logging.getLogger(__name__)


def _normalize_script_text(script: str) -> str:
    cleaned = script.replace("\r", " ").replace("\n", " ")
    return " ".join(cleaned.split())


def _truncate_description(text: str, limit: int = 500) -> str:
    if len(text) <= limit:
        return text
    return f"{text[: limit - 3].rstrip()}..."


def _prepare_presentation_payload(data: dict) -> dict:
    prepared = dict(data)
    cards = prepared.get("cards") or []

    if cards:
        first_card = cards[0]
        if not prepared.get("title"):
            prepared["title"] = first_card.get("title") or "Generated Presentation"
        if not prepared.get("color"):
            prepared["color"] = first_card.get("color") or "#3366FF"

    return prepared


class DeckGenerationService:
    def __init__(self, ai_client: Optional[AIClient] = None):
        self._ai_client = ai_client or AIClient()

    def generate(self, body: DeckGenerateRequest) -> AIDeckOutput:
        target_words = calculateTargetWords(body.duration_minutes, body.audience_index)
        presentation = self._generate_presentation(body)
        cards = self._complete_missing_cards(body, presentation)
        script = self._normalize_and_build_script(cards)
        title = self._resolve_title(presentation, cards)
        color = self._resolve_color(presentation, cards)

        if not validatePresentationLength(script, target_words):
            presentation = self._expand_presentation(body, presentation, target_words)
            cards = self._sorted_cards(presentation)
            script = self._normalize_and_build_script(cards)
            title = self._resolve_title(presentation, cards)
            color = self._resolve_color(presentation, cards)

        return AIDeckOutput(
            title=title,
            script=script,
            color=color,
            cards=[self._to_public_card(card) for card in cards],
        )

    def _sorted_cards(self, presentation: AIGeneratedPresentationOutput):
        return sorted(presentation.cards, key=lambda card: card.cardNumber)

    def _merge_expanded_cards(self, base_cards, expanded_cards, expected_count: int):
        expanded_by_number = {card.cardNumber: card for card in expanded_cards}
        merged_cards = []

        for card in base_cards:
            merged_cards.append(expanded_by_number.get(card.cardNumber, card))

        return merged_cards[:expected_count]

    def _complete_missing_cards(
        self,
        body: DeckGenerateRequest,
        presentation: AIGeneratedPresentationOutput,
    ):
        cards = self._sorted_cards(presentation)

        while len(cards) < body.card_count:
            missing_count = body.card_count - len(cards)
            batch_start_index = len(cards) + 1
            batch_presentation = self._generate_missing_card_batch(
                body,
                presentation,
                cards,
                batch_start_index=batch_start_index,
                batch_size=missing_count,
            )

            batch_cards = self._sorted_cards(batch_presentation)
            batch_cards = [card for card in batch_cards if card.cardNumber >= batch_start_index]

            cards.extend(batch_cards)

            if len(cards) > body.card_count:
                cards = cards[: body.card_count]

            if not batch_cards:
                break

        presentation.cards = cards
        return cards

    def _generate_missing_card_batch(
        self,
        body: DeckGenerateRequest,
        presentation: AIGeneratedPresentationOutput,
        generated_cards,
        *,
        batch_start_index: int,
        batch_size: int,
    ) -> AIGeneratedPresentationOutput:
        system_prompt = build_card_system_prompt()
        batch_user_prompt = build_card_batch_user_prompt(
            body,
            script_title=self._resolve_title(presentation, generated_cards),
            script=self._normalize_and_build_script(generated_cards),
            generated_cards=generated_cards,
            batch_size=batch_size,
            batch_start_index=batch_start_index,
        )

        raw_json = self._ai_client.generate_json(
            system_prompt=system_prompt,
            user_prompt=batch_user_prompt,
            temperature=0.4,
        )
        try:
            data = _prepare_presentation_payload(json.loads(raw_json))
            batch_presentation = AIGeneratedPresentationOutput.model_validate(data)
        except (json.JSONDecodeError, ValidationError, AIGenerationError) as exc:
            raise AIResponseParsingError(f"AI failed to generate missing cards: {exc}") from exc

        return batch_presentation

    def _normalize_and_build_script(self, cards) -> str:
        return _normalize_script_text(buildScriptFromCards(cards))

    def _to_public_card(self, card) -> AICardOutput:
        return AICardOutput(
            title=card.title,
            description=_truncate_description(card.speakerNotes),
            color=card.color,
            impact=card.impact,
            delivery=card.delivery,
        )

    def _resolve_title(self, presentation: AIGeneratedPresentationOutput, cards) -> str:
        if presentation.title:
            return presentation.title
        if cards:
            return cards[0].title
        return "Generated Presentation"

    def _resolve_color(self, presentation: AIGeneratedPresentationOutput, cards) -> str:
        if presentation.color:
            return presentation.color
        if cards:
            return cards[0].color
        return "#3366FF"

    def _generate_presentation(self, body: DeckGenerateRequest) -> AIGeneratedPresentationOutput:
        system_prompt = build_card_system_prompt()
        base_user_prompt = build_card_generation_user_prompt(body)
        user_prompt = base_user_prompt
        last_error: Optional[Exception] = None
        expected_card_count = body.card_count

        for attempt in range(1, settings.MAX_REPAIR_ATTEMPTS + 1):
            try:
                raw_json = self._ai_client.generate_json(
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    temperature=0.7 if attempt == 1 else 0.4,
                )
                data = _prepare_presentation_payload(json.loads(raw_json))
                presentation = AIGeneratedPresentationOutput.model_validate(data)

                if len(presentation.cards) > expected_card_count:
                    presentation.cards = presentation.cards[:expected_card_count]

                return presentation
            except (json.JSONDecodeError, ValidationError, AIGenerationError, AIResponseParsingError) as exc:
                last_error = exc
                logger.warning(
                    "Presentation generation attempt %s/%s failed: %s",
                    attempt,
                    settings.MAX_REPAIR_ATTEMPTS,
                    exc,
                )
                user_prompt = (
                    f"{base_user_prompt}\n\n"
                    f"IMPORTANT: Your previous presentation response was invalid and was rejected:\n{exc}\n\n"
                    f"Return exactly {expected_card_count} cards. Each card must include cardNumber, title, speakerNotes, slideContent, estimatedWordCount, estimatedDurationSeconds, impact, delivery, and color."
                )

        raise AIResponseParsingError(
            f"AI failed to produce a valid presentation after {settings.MAX_REPAIR_ATTEMPTS} attempts: {last_error}"
        )

    def _expand_presentation(
        self,
        body: DeckGenerateRequest,
        presentation: AIGeneratedPresentationOutput,
        target_words: int,
    ) -> AIGeneratedPresentationOutput:
        system_prompt = build_card_system_prompt()
        current_script = self._normalize_and_build_script(self._sorted_cards(presentation))
        user_prompt = build_card_expansion_user_prompt(
            body,
            current_script=current_script,
            target_words=target_words,
        )

        raw_json = self._ai_client.generate_json(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=0.4,
        )
        try:
            data = _prepare_presentation_payload(json.loads(raw_json))
            expanded_presentation = AIGeneratedPresentationOutput.model_validate(data)
        except (json.JSONDecodeError, ValidationError, AIGenerationError) as exc:
            raise AIResponseParsingError(f"AI failed to expand the presentation: {exc}") from exc

        if len(expanded_presentation.cards) != body.card_count:
            logger.warning(
                "AI returned %s cards during expansion, expected %s; merging with existing deck",
                len(expanded_presentation.cards),
                body.card_count,
            )
            expanded_presentation.cards = self._merge_expanded_cards(
                self._sorted_cards(presentation),
                self._sorted_cards(expanded_presentation),
                body.card_count,
            )

        return expanded_presentation
