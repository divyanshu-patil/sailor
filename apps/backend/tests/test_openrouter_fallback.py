"""The free-tier prefix is the only new branch: OpenRouter answers, or it hits
its limit and the configured provider takes over — for this call and for the
ones after it, without a second doomed round trip."""

import unittest
from unittest.mock import patch

from app.services.ai import chat as chat_module
from app.services.ai.chat import ModelCallError, chat, provider_chain
from app.services.ai.providers.base import (
    ChatRequest,
    ProviderError,
    RateLimitedError,
)
from app.services.ai.providers.openrouter_provider import OpenRouterProvider

MESSAGES = [{"role": "system", "content": "sys"}, {"role": "user", "content": "hi"}]


class FakeProvider:
    def __init__(self, name, answer=None, error=None):
        self.name = name
        self.answer = answer
        self.error = error
        self.calls = 0

    def models(self):
        return [f"{self.name}-primary", f"{self.name}-fallback"]

    def complete(self, request, model):
        self.calls += 1
        if self.error:
            raise self.error
        return self.answer


class OpenRouterFallbackTests(unittest.TestCase):
    def setUp(self):
        chat_module._openrouter_ready_at = 0.0

    def _run(self, chain):
        with patch.object(chat_module, "provider_chain", return_value=chain):
            return chat(MESSAGES)

    def test_free_provider_answers_when_it_can(self):
        free = FakeProvider("openrouter", answer="free text")
        paid = FakeProvider("ollama", answer="paid text")
        self.assertEqual(self._run([free, paid]), "free text")
        self.assertEqual(paid.calls, 0)

    def test_rate_limit_falls_through_without_retrying_the_sibling_model(self):
        free = FakeProvider("openrouter", error=RateLimitedError("429"))
        paid = FakeProvider("ollama", answer="paid text")
        self.assertEqual(self._run([free, paid]), "paid text")
        # One attempt, not a retry loop and not the second free model: the limit
        # is on the account, so switching provider is the only thing that helps.
        self.assertEqual(free.calls, 1)

    def test_rate_limit_parks_the_free_provider_for_later_calls(self):
        free = FakeProvider("openrouter", error=RateLimitedError("429"))
        paid = FakeProvider("ollama", answer="paid text")
        self._run([free, paid])
        self.assertTrue(chat_module._openrouter_parked())

        with patch.object(chat_module.settings, "AI_USE_OPENROUTER", True), patch.object(
            chat_module.settings, "OPENROUTER_API_KEY", "sk-or-test"
        ):
            self.assertNotIn("openrouter", [p.name for p in provider_chain()])

    def test_a_broken_free_model_still_reaches_the_fallback(self):
        free = FakeProvider("openrouter", error=ProviderError("no endpoints"))
        paid = FakeProvider("ollama", answer="paid text")
        self.assertEqual(self._run([free, paid]), "paid text")
        # Both free models were tried and both refused. A retired id or a
        # privacy setting won't have fixed itself by the next beat, so it parks
        # too — otherwise every call in the fan-out pays the same dead round
        # trip.
        self.assertEqual(free.calls, 2)
        self.assertTrue(chat_module._openrouter_parked())

    def test_a_broken_only_provider_does_not_park(self):
        """Nothing behind it to fall back to — parking would just mean skipping
        the only provider there is."""
        free = FakeProvider("openrouter", error=ProviderError("no endpoints"))
        with self.assertRaises(ModelCallError):
            self._run([free])
        self.assertFalse(chat_module._openrouter_parked())

    def test_last_provider_still_raises_when_everything_fails(self):
        paid = FakeProvider("ollama", error=ProviderError("down"))
        with self.assertRaises(ModelCallError):
            self._run([paid])

    def test_http_402_counts_as_rate_limited_not_failure(self):
        """An exhausted free budget is a wait, not a broken call — it has to
        reach the breaker, or every later call pays the same doomed round trip.
        402 has no dedicated SDK exception, so it arrives as a bare
        APIStatusError alongside every other unmapped status."""
        import httpx
        import openai

        def status_error(code):
            response = httpx.Response(
                code,
                request=httpx.Request("POST", "https://openrouter.ai/api/v1/x"),
                json={"error": {"code": code, "message": "boom"}},
            )
            return openai.APIStatusError("boom", response=response, body=None)

        request = ChatRequest(system="s", messages=[{"role": "user", "content": "u"}])
        # RateLimitedError subclasses ProviderError, so the 500 case is asserted
        # on the type itself — assertRaises(ProviderError) would pass either way.
        for code, is_rate_limit in ((402, True), (500, False)):
            with patch.object(OpenRouterProvider, "_client") as client:
                client.return_value.chat.completions.create.side_effect = status_error(code)
                with self.assertRaises(ProviderError) as caught:
                    OpenRouterProvider().complete(request, "some/model:free")
                self.assertEqual(
                    isinstance(caught.exception, RateLimitedError), is_rate_limit, code
                )

    def test_only_free_model_ids_are_ever_sent(self):
        with patch.object(
            chat_module.settings, "OPENROUTER_MODEL", "openai/gpt-4o"
        ), patch.object(
            chat_module.settings,
            "OPENROUTER_FALLBACK_MODEL",
            "google/gemma-3-27b-it:free",
        ):
            self.assertEqual(
                OpenRouterProvider().models(), ["google/gemma-3-27b-it:free"]
            )


if __name__ == "__main__":
    unittest.main()
