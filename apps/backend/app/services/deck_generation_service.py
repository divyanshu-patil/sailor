import json
import logging
from typing import Optional

from pydantic import ValidationError

from app.core.exceptions import AIGenerationError, AIResponseParsingError
from app.schemas.deck_schema import DeckGenerateRequest
from app.schemas.ai_schema import AIDeckOutput
from app.services.ai.client import AIClient
from app.services.ai.prompts import (
    build_deck_system_prompt,
    build_deck_user_prompt,
    estimate_max_tokens,
)

logger = logging.getLogger(__name__)

MAX_REPAIR_ATTEMPTS = 3


class DeckGenerationService:
    def __init__(self, ai_client: Optional[AIClient] = None):
        self._ai_client = ai_client or AIClient()

    def generate(self, body: DeckGenerateRequest) -> AIDeckOutput:
        system_prompt = build_deck_system_prompt()
        base_user_prompt = build_deck_user_prompt(body)
        max_tokens = estimate_max_tokens(body.card_count, body.duration_minutes)

        user_prompt = base_user_prompt
        last_error: Optional[Exception] = None

        for attempt in range(1, MAX_REPAIR_ATTEMPTS + 1):
            try:
                raw_json = self._ai_client.generate_json(
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    max_tokens=max_tokens,
                    # slightly lower temperature on repair attempts for more compliant output
                    temperature=0.7 if attempt == 1 else 0.4,
                )
                data = json.loads(raw_json)
                deck_output = AIDeckOutput.model_validate(data)

            except (json.JSONDecodeError, ValidationError, AIGenerationError) as exc:
                last_error = exc
                logger.warning("Generation attempt %s/%s failed: %s", attempt, MAX_REPAIR_ATTEMPTS, exc)
                user_prompt = (
                    f"{base_user_prompt}\n\n"
                    f"IMPORTANT: Your previous response was invalid and was rejected:\n{exc}\n\n"
                    f"Return the COMPLETE corrected JSON object with exactly {body.card_count} "
                    f"fully-populated cards. Every title and description must be non-empty. "
                    f"Do not omit or truncate any card."
                )
                continue

            if len(deck_output.cards) != body.card_count:
                logger.warning(
                    "Attempt %s: got %s cards, expected %s.",
                    attempt, len(deck_output.cards), body.card_count,
                )
                if len(deck_output.cards) > body.card_count:
                    deck_output.cards = deck_output.cards[: body.card_count]
                    return deck_output
                last_error = AIResponseParsingError(
                    f"AI returned {len(deck_output.cards)} cards, expected {body.card_count}"
                )
                user_prompt = (
                    f"{base_user_prompt}\n\n"
                    f"IMPORTANT: Your previous response only included "
                    f"{len(deck_output.cards)} cards. Return exactly {body.card_count} "
                    f"complete cards, no fewer."
                )
                continue

            return deck_output

        raise AIResponseParsingError(
            f"AI failed to produce a valid deck after {MAX_REPAIR_ATTEMPTS} attempts: {last_error}"
        )