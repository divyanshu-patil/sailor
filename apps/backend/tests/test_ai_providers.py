"""The provider adapters, each with its SDK client replaced by a fake — the
request each one builds, and how it maps each failure onto ProviderError /
RateLimitedError."""

from types import SimpleNamespace

import anthropic
import httpx
import openai
import pytest

from app.services.ai.providers import (
    anthropic_provider,
    gemini_provider,
    ollama_provider,
    openai_provider,
)
from app.services.ai.providers.base import (
    ChatRequest,
    ImageInput,
    ProviderError,
    RateLimitedError,
)

IMAGE = ImageInput(data=b"img", media_type="image/png")
REQUEST = ChatRequest(system="sys", messages=[{"role": "user", "content": "hi"}], images=(IMAGE,))
PLAIN = ChatRequest(system="sys", messages=[{"role": "user", "content": "hi"}], fast=False)
HTTP_REQUEST = httpx.Request("POST", "https://api.example/v1")


def http_response(status, headers=None):
    return httpx.Response(status, request=HTTP_REQUEST, headers=headers or {})


def test_image_base64():
    assert IMAGE.base64_data == "aW1n"


class TestOllama:
    def provider(self, monkeypatch, chat):
        provider = ollama_provider.OllamaProvider()
        monkeypatch.setattr(provider, "_client", lambda: SimpleNamespace(chat=chat))
        return provider

    def test_builds_the_request_and_returns_content(self, monkeypatch):
        seen = {}

        def chat(**kwargs):
            seen.update(kwargs)
            return {"message": {"content": "  answer  "}}

        assert self.provider(monkeypatch, chat).complete(REQUEST, "m1") == "answer"
        assert seen["think"] is False
        assert seen["messages"][0] == {"role": "system", "content": "sys"}
        assert seen["messages"][-1]["images"] == ["aW1n"]

    def test_empty_content(self, monkeypatch):
        with pytest.raises(ProviderError):
            self.provider(monkeypatch, lambda **_: {"message": None}).complete(PLAIN, "m1")

    @pytest.mark.parametrize(
        "error, expected",
        [
            (SimpleNamespace(status_code=429), RateLimitedError),
            (Exception("Too many requests"), RateLimitedError),
            (Exception("read timeout"), ProviderError),
            (Exception("boom"), ProviderError),
        ],
    )
    def test_failures(self, monkeypatch, error, expected):
        def chat(**_):
            if isinstance(error, SimpleNamespace):
                exc = Exception("rate")
                exc.status_code = 429
                raise exc
            raise error

        with pytest.raises(expected):
            self.provider(monkeypatch, chat).complete(PLAIN, "m-fail")

    def test_models_without_think_are_retried_and_remembered(self, monkeypatch):
        calls = []

        def chat(**kwargs):
            calls.append("think" in kwargs)
            if "think" in kwargs:
                raise Exception("model does not support thinking")
            return {"message": {"content": "ok"}}

        provider = self.provider(monkeypatch, chat)
        assert provider.complete(PLAIN, "no-think") == "ok"
        assert provider.complete(PLAIN, "no-think") == "ok"
        assert calls == [True, False, False]

    def test_retry_without_think_can_fail_too(self, monkeypatch):
        def chat(**kwargs):
            raise Exception("thinking unsupported") if "think" in kwargs else Exception("still broken")

        with pytest.raises(ProviderError, match="still broken"):
            self.provider(monkeypatch, chat).complete(PLAIN, "no-think-2")

    def test_client_is_cached_and_models_listed(self, monkeypatch):
        from app.config.settings import settings

        monkeypatch.setattr(settings, "AI_MODEL", "a")
        monkeypatch.setattr(settings, "AI_FALLBACK_MODEL", "")
        provider = ollama_provider.OllamaProvider()
        assert provider.models() == ["a"]
        assert provider._client() is provider._client()


class TestOpenAI:
    def provider(self, monkeypatch, create):
        provider = openai_provider.OpenAIProvider()
        client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
        monkeypatch.setattr(provider, "_client", lambda: client)
        return provider

    def test_request_shape_and_reasoning_effort(self, monkeypatch):
        seen = {}

        def create(**kwargs):
            seen.update(kwargs)
            return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=" out "))])

        provider = self.provider(monkeypatch, create)
        assert provider.complete(REQUEST, "gpt-5-mini") == "out"
        assert seen["reasoning_effort"] == "low"
        assert seen["max_completion_tokens"] == REQUEST.max_tokens
        assert seen["messages"][-1]["content"][1]["image_url"]["url"].startswith("data:image/png;base64,")
        provider.complete(PLAIN, "gpt-4o")
        assert "reasoning_effort" not in seen or seen["model"] == "gpt-4o"

    def test_empty_and_failures(self, monkeypatch):
        def empty(**_):
            return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=None))])

        with pytest.raises(ProviderError):
            self.provider(monkeypatch, empty).complete(PLAIN, "m")

        def raiser(exc):
            def create(**_):
                raise exc

            return create

        limited = openai.RateLimitError("slow down", response=http_response(429, {"retry-after": "7"}), body=None)
        with pytest.raises(RateLimitedError) as caught:
            self.provider(monkeypatch, raiser(limited)).complete(PLAIN, "m")
        assert caught.value.retry_after == 7.0

        status = openai.APIStatusError("bad", response=http_response(500), body=None)
        with pytest.raises(ProviderError) as caught:
            self.provider(monkeypatch, raiser(status)).complete(PLAIN, "m")
        assert caught.value.status_code == 500

        with pytest.raises(ProviderError, match="unreachable"):
            self.provider(monkeypatch, raiser(openai.APIConnectionError(request=HTTP_REQUEST))).complete(PLAIN, "m")
        with pytest.raises(ProviderError):
            self.provider(monkeypatch, raiser(ValueError("x"))).complete(PLAIN, "m")

    def test_retry_after_parsing(self):
        def err(headers):
            return SimpleNamespace(response=SimpleNamespace(headers=headers))

        assert openai_provider._retry_after(err({"retry-after": "3"})) == 3.0
        assert openai_provider._retry_after(err({"retry-after": "soon"})) is None
        assert openai_provider._retry_after(err({"x-ratelimit-reset": "0"})) == 0.0
        assert openai_provider._retry_after(err({"x-ratelimit-reset": "later"})) is None
        assert openai_provider._retry_after(SimpleNamespace()) is None

    def test_real_client_construction(self, monkeypatch):
        from app.config.settings import settings

        monkeypatch.setattr(settings, "OPENAI_API_KEY", "sk-test")
        monkeypatch.setattr(settings, "OPENAI_BASE_URL", "")
        client = openai_provider.OpenAIProvider()._client()
        assert client.api_key == "sk-test"
        monkeypatch.setattr(settings, "AI_MODEL", "x")
        monkeypatch.setattr(settings, "AI_FALLBACK_MODEL", "y")
        assert openai_provider.OpenAIProvider().models() == ["x", "y"]


class TestAnthropic:
    def provider(self, monkeypatch, create):
        provider = anthropic_provider.AnthropicProvider()
        monkeypatch.setattr(provider, "_client", lambda: SimpleNamespace(messages=SimpleNamespace(create=create)))
        return provider

    def test_request_shape(self, monkeypatch):
        seen = {}

        def create(**kwargs):
            seen.update(kwargs)
            return SimpleNamespace(
                stop_reason="end_turn",
                content=[SimpleNamespace(type="text", text="hello "), SimpleNamespace(type="thinking")],
            )

        assert self.provider(monkeypatch, create).complete(REQUEST, "claude") == "hello"
        assert seen["system"] == "sys"
        assert seen["output_config"] == {"effort": "low"}
        assert seen["messages"][-1]["content"][1]["source"]["data"] == "aW1n"

    def test_refusal_empty_and_failures(self, monkeypatch):
        def refuse(**_):
            return SimpleNamespace(stop_reason="refusal", content=[])

        with pytest.raises(ProviderError, match="declined"):
            self.provider(monkeypatch, refuse).complete(PLAIN, "c")
        def empty(**_):
            return SimpleNamespace(stop_reason="end_turn", content=[])

        with pytest.raises(ProviderError, match="empty"):
            self.provider(monkeypatch, empty).complete(PLAIN, "c")

        def raiser(exc):
            def create(**_):
                raise exc

            return create

        cases = [
            (anthropic.RateLimitError("slow", response=http_response(429), body=None), RateLimitedError),
            (anthropic.APIStatusError("bad", response=http_response(500), body=None), ProviderError),
            (anthropic.APIConnectionError(request=HTTP_REQUEST), ProviderError),
            (ValueError("x"), ProviderError),
        ]
        for exc, expected in cases:
            with pytest.raises(expected):
                self.provider(monkeypatch, raiser(exc)).complete(PLAIN, "c")

    def test_real_client_and_models(self, monkeypatch):
        from app.config.settings import settings

        monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", "sk-ant-test")
        assert anthropic_provider.AnthropicProvider()._client().api_key == "sk-ant-test"
        monkeypatch.setattr(settings, "AI_MODEL", "c")
        monkeypatch.setattr(settings, "AI_FALLBACK_MODEL", "")
        assert anthropic_provider.AnthropicProvider().models() == ["c"]


class TestGemini:
    def provider(self, monkeypatch, create):
        provider = gemini_provider.GeminiProvider()
        provider._cached_client = SimpleNamespace(interactions=SimpleNamespace(create=create))
        return provider

    def test_steps_and_request(self, monkeypatch):
        seen = {}

        def create(**kwargs):
            seen.update(kwargs)
            return SimpleNamespace(status="completed", output_text=" done ")

        request = ChatRequest(
            system="sys",
            messages=[
                {"role": "user", "content": "first"},
                {"role": "assistant", "content": "reply"},
                {"role": "user", "content": ""},
            ],
            images=(IMAGE,),
        )
        assert self.provider(monkeypatch, create).complete(request, "g") == "done"
        assert seen["system_instruction"] == "sys"
        assert seen["generation_config"]["thinking_level"] == "LOW"
        types = [step["type"] for step in seen["input"]]
        assert types == ["user_input", "model_output", "user_input"]
        assert seen["input"][-1]["content"][0]["type"] == "image"

    def test_no_system_and_steps_skip_empty_turns(self, monkeypatch):
        seen = {}

        def create(**kwargs):
            seen.update(kwargs)
            return SimpleNamespace(status="completed", output_text="ok")

        request = ChatRequest(system="", messages=[{"role": "user", "content": "x"}, {"role": "assistant", "content": ""}], fast=False)
        self.provider(monkeypatch, create).complete(request, "g2")
        assert "system_instruction" not in seen
        assert len(seen["input"]) == 1

    def test_failed_and_empty(self, monkeypatch):
        with pytest.raises(ProviderError, match="declined"):
            self.provider(monkeypatch, lambda **_: SimpleNamespace(status="failed", output_text="")).complete(PLAIN, "g")
        with pytest.raises(ProviderError, match="empty"):
            self.provider(monkeypatch, lambda **_: SimpleNamespace(status="completed", output_text=None)).complete(PLAIN, "g")

    def test_rate_limit_with_retry_hints(self, monkeypatch):
        def limited(header=None, body=None):
            exc = Exception("quota")
            exc.status_code = 429
            exc.response = SimpleNamespace(headers={"retry-after": header} if header else {})
            exc.body = body
            return exc

        for exc, delay in [
            (limited("12"), 12.0),
            (limited("soon", '{"retryDelay": "4s"}'), 4.0),
            (limited(None, "nothing"), None),
        ]:
            def create(exc=exc, **_):
                raise exc

            with pytest.raises(RateLimitedError) as caught:
                self.provider(monkeypatch, create).complete(PLAIN, "g")
            assert caught.value.retry_after == delay

        coded = Exception("quota")
        coded.code = 429
        assert gemini_provider.GeminiProvider._status_code(coded) == 429
        assert gemini_provider.GeminiProvider._status_code(Exception()) is None

    def test_thinking_unsupported_is_retried_and_remembered(self, monkeypatch):
        calls = []

        def create(**kwargs):
            calls.append("thinking_level" in kwargs["generation_config"])
            if "thinking_level" in kwargs["generation_config"]:
                raise Exception("thinking_level is not supported")
            return SimpleNamespace(status="completed", output_text="ok")

        provider = self.provider(monkeypatch, create)
        assert provider.complete(PLAIN, "no-thinking") == "ok"
        assert provider.complete(PLAIN, "no-thinking") == "ok"
        assert calls == [True, False, False]

    def test_retry_failures_and_other_errors(self, monkeypatch):
        def fails_twice(**kwargs):
            if "thinking_level" in kwargs["generation_config"]:
                raise Exception("thinking unsupported")
            raise Exception("down")

        with pytest.raises(ProviderError, match="down"):
            self.provider(monkeypatch, fails_twice).complete(PLAIN, "nt-2")

        def retry_declines(**kwargs):
            if "thinking_level" in kwargs["generation_config"]:
                raise Exception("thinking unsupported")
            return SimpleNamespace(status="failed", output_text="")

        with pytest.raises(ProviderError, match="declined"):
            self.provider(monkeypatch, retry_declines).complete(PLAIN, "nt-3")

        def other(**_):
            raise Exception("network")

        with pytest.raises(ProviderError, match="network"):
            self.provider(monkeypatch, other).complete(PLAIN, "g")

    def test_client_is_built_once(self, monkeypatch):
        from app.config.settings import settings

        monkeypatch.setattr(settings, "GEMINI_API_KEY", "g-key")
        provider = gemini_provider.GeminiProvider()
        assert provider._client() is provider._client()
        monkeypatch.setattr(settings, "AI_MODEL", "g")
        monkeypatch.setattr(settings, "AI_FALLBACK_MODEL", "")
        assert provider.models() == ["g"]
