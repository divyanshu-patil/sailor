import logging
from concurrent.futures import Future, ThreadPoolExecutor
from typing import Callable, Iterable, TypeVar

from app.config.settings import settings
from app.services.ai.providers import ChatRequest, ProviderError, get_provider

logger = logging.getLogger("celery")

T = TypeVar("T")


class ModelCallError(Exception):
    """Raised when no configured model could answer a single call."""


def _split_system(messages: list[dict]) -> tuple[str, list[dict]]:
    """
    Pull leading system messages out of a prompt.

    The prompt builders in this package write `[{system}, {user}]`, which is
    Ollama's and OpenAI's shape but not Anthropic's — there the system prompt is
    its own request parameter. Splitting here means the prompts don't have to
    care which provider is configured, and each adapter re-assembles whatever it
    needs.
    """
    system_parts: list[str] = []
    rest: list[dict] = []
    for message in messages:
        if message.get("role") == "system" and not rest:
            system_parts.append(str(message.get("content", "")))
        else:
            rest.append(message)
    return "\n\n".join(p for p in system_parts if p), rest


def chat(messages: list[dict], *, fast: bool | None = None) -> str:
    """
    One completion, primary model first and the fallback behind it.

    Provider-neutral: which service actually runs it is settings.AI_PROVIDER.
    `fast` defaults to settings.AI_FAST — every call this app makes is heavily
    prompt-constrained, so a deliberation pass is mostly re-deriving what the
    prompt already states, on the user's clock. Each adapter maps it onto
    whatever its provider actually exposes.
    """
    provider = get_provider()
    request = ChatRequest(
        *_split_system(messages),
        fast=settings.AI_FAST if fast is None else fast,
    )

    models = provider.models()
    if not models:
        raise ModelCallError("No models configured — set AI_MODEL.")

    last_error: Exception | None = None
    for model in models:
        try:
            return provider.complete(request, model)
        except ProviderError as e:
            logger.warning(f"[ai] {provider.name}:{model} failed: {e}")
            last_error = e
        except Exception as e:  # anything an adapter failed to wrap
            logger.warning(f"[ai] {provider.name}:{model} failed: {e}")
            last_error = e

    raise ModelCallError(f"All {provider.name} models failed. Last error: {last_error}")


def map_parallel(fn: Callable[[T], object], items: Iterable[T]) -> list:
    """
    Run `fn` over `items` concurrently, returning results in the original order.

    Both fan-outs in this package — one call per script beat, one per card batch
    — are lists of calls that don't depend on each other, and running them in
    sequence meant a generation took the sum of every call's latency instead of
    the slowest one's. Order is preserved because both callers assemble their
    output positionally: beats concatenate into a script, card batches into a
    numbered deck.

    The first exception raised is re-raised here, after cancelling whatever
    hasn't started yet — a partial script is never useful, so there is nothing to
    salvage by letting the rest finish.
    """
    work = list(items)
    if not work:
        return []
    if len(work) == 1:
        return [fn(work[0])]

    max_workers = max(1, min(len(work), settings.AI_MAX_CONCURRENCY))
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures: list[Future] = [pool.submit(fn, item) for item in work]
        try:
            return [future.result() for future in futures]
        except Exception:
            for future in futures:
                future.cancel()
            raise
