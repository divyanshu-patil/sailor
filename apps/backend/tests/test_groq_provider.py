"""The Groq adapter is a subclass, so what is worth testing is exactly what it
overrides — where it points, what it calls its token limit, and that the
registry hands it back for AI_PROVIDER=groq.

The inherited behaviour (message shape, images, 429 mapping) is
OpenAIProvider's and is covered by being the same code, not a copy of it. The
test that matters is that it stays a subclass: the day someone forks the body
of `complete` into here, this file stops being enough.
"""

import unittest
from unittest.mock import patch

from app.config.settings import settings
from app.services.ai.providers import get_provider
from app.services.ai.providers.base import ProviderError
from app.services.ai.providers.groq_provider import GROQ_BASE_URL, GroqProvider
from app.services.ai.providers.openai_provider import OpenAIProvider


class GroqAdapter(unittest.TestCase):
    def test_points_at_groq_with_the_groq_key(self):
        with patch.object(settings, "GROQ_API_KEY", "gsk_test"):
            key, base_url = GroqProvider()._credentials()
        self.assertEqual(key, "gsk_test")
        self.assertEqual(base_url, GROQ_BASE_URL)

    def test_does_not_borrow_the_openai_key(self):
        """A half-configured install should fail loudly on Groq rather than
        quietly spending someone's OpenAI credit."""
        with patch.object(settings, "GROQ_API_KEY", ""), patch.object(
            settings, "OPENAI_API_KEY", "sk-openai"
        ):
            key, _ = GroqProvider()._credentials()
        self.assertEqual(key, "")

    def test_uses_the_pre_rename_token_parameter(self):
        # Groq documents `max_tokens`; `max_completion_tokens` is OpenAI's
        # rename and is not what this endpoint advertises.
        self.assertEqual(GroqProvider.max_tokens_param, "max_tokens")
        self.assertEqual(OpenAIProvider.max_tokens_param, "max_completion_tokens")

    def test_reads_the_shared_model_settings(self):
        """Like every other *selected* provider — OpenRouter is the one that
        carries its own model list, because it runs in front of the selection
        rather than being it."""
        with patch.object(settings, "AI_MODEL", "llama-3.3-70b-versatile"), patch.object(
            settings, "AI_FALLBACK_MODEL", "llama-3.1-8b-instant"
        ):
            self.assertEqual(
                GroqProvider().models(),
                ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
            )

    def test_inherits_rather_than_reimplements(self):
        self.assertTrue(issubclass(GroqProvider, OpenAIProvider))
        self.assertIs(GroqProvider.complete, OpenAIProvider.complete)


class Registry(unittest.TestCase):
    def test_ai_provider_groq_resolves(self):
        provider = get_provider("groq")
        self.assertIsInstance(provider, GroqProvider)
        self.assertEqual(provider.name, "groq")

    def test_case_and_padding_are_forgiven(self):
        self.assertIsInstance(get_provider("  GROQ "), GroqProvider)

    def test_unknown_provider_names_the_valid_ones(self):
        with self.assertRaises(ProviderError) as caught:
            get_provider("grok")
        self.assertIn("groq", str(caught.exception))


if __name__ == "__main__":
    unittest.main()
