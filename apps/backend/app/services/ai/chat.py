import logging
import random
import time
from concurrent.futures import Future, ThreadPoolExecutor
from typing import Callable, Iterable, Sequence, TypeVar

from app.config.settings import settings
from app.services.ai.providers import (
    ChatRequest,
    ImageInput,
    ProviderError,
    RateLimitedError,
    get_provider,
)
from app.services.ai.providers.base import MAX_IMAGES_PER_REQUEST
from app.services.ai.rate_limit import AdaptiveLimiter

logger = logging.getLogger("celery")

T = TypeVar("T")


class ModelCallError(Exception):
    """Raised when no configured model could answer a single call."""


# Every provider call in this process passes through here.
#
# AI_MAX_CONCURRENCY stays the ceiling — this does not lower it. What it adds is
# a floor-to-ceiling range: the fan-outs bound themselves individually, but the
# provider's limit is per *account* and nothing counted across them, so a worker
# generating a script (7 concurrent beats) alongside a card job overshot and took
# 429s. The limiter counts across tasks and, when the provider does push back,
# backs off temporarily and climbs straight back to the ceiling.
_limiter = AdaptiveLimiter(settings.AI_MAX_CONCURRENCY)

# A 429 here is self-inflicted — the pipeline out-ran the account's ceiling, not
# a sign anything is broken. Waiting and retrying is the correct response.
MAX_RATE_LIMIT_RETRIES = 5
RATE_LIMIT_BASE_DELAY = 1.5
RATE_LIMIT_MAX_DELAY = 20.0


def _rate_limit_delay(attempt: int, retry_after: float | None) -> float:
    """Exponential backoff with jitter, honouring the provider's own hint.

    The jitter matters more than usual here: a fan-out that gets rate-limited
    gets rate-limited on every branch at once, so retrying them all on the same
    schedule just reproduces the burst that caused it.
    """
    if retry_after is not None:
        return min(retry_after, RATE_LIMIT_MAX_DELAY)
    backoff = min(RATE_LIMIT_BASE_DELAY * (2**attempt), RATE_LIMIT_MAX_DELAY)
    return backoff * (0.5 + random.random())


def _complete_with_retry(provider, request: ChatRequest, model: str) -> str:
    """One model, retried for as long as it's only rate limiting us."""
    last_error: RateLimitedError | None = None

    for attempt in range(MAX_RATE_LIMIT_RETRIES + 1):
        try:
            with _limiter.slot():
                result = provider.complete(request, model)
        except RateLimitedError as e:
            _limiter.record_rate_limited()
            last_error = e
            if attempt == MAX_RATE_LIMIT_RETRIES:
                break
            delay = _rate_limit_delay(attempt, e.retry_after)
            logger.info(
                f"[ai] {provider.name}:{model} rate limited, retrying in {delay:.1f}s "
                f"({attempt + 1}/{MAX_RATE_LIMIT_RETRIES})"
            )
            time.sleep(delay)
            continue

        # Outside the slot: a success is what earns the limiter's way back up to
        # the ceiling after a period of backing off.
        _limiter.record_success()
        return result

    raise last_error if last_error else ProviderError("rate limited")


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


def chat(
    messages: list[dict],
    *,
    images: Sequence[ImageInput] = (),
    fast: bool | None = None,
) -> str:
    """
    One completion, primary model first and the fallback behind it.

    Provider-neutral: which service actually runs it is settings.AI_PROVIDER.
    `images` are attached to the final user turn by each adapter, capped at
    MAX_IMAGES_PER_REQUEST. `fast` defaults to settings.AI_FAST — every call this app makes is heavily
    prompt-constrained, so a deliberation pass is mostly re-deriving what the
    prompt already states, on the user's clock. Each adapter maps it onto
    whatever its provider actually exposes.
    """
    provider = get_provider()
    request = ChatRequest(
        *_split_system(messages),
        images=tuple(images)[:MAX_IMAGES_PER_REQUEST],
        fast=settings.AI_FAST if fast is None else fast,
    )

    models = provider.models()
    if not models:
        raise ModelCallError("No models configured — set AI_MODEL.")

    last_error: Exception | None = None
    for model in models:
        try:
            return _complete_with_retry(provider, request, model)
        except RateLimitedError as e:
            # Still limited after backing off. Trying the fallback model is
            # pointless where the limit is per-account — it draws on the same
            # exhausted budget and fails instantly, which is what doubled the
            # 429s in the logs. Stop here and let the task's own retry pick it
            # up once the burst has cleared.
            logger.warning(f"[ai] {provider.name}:{model} still rate limited, giving up")
            raise ModelCallError(f"{provider.name} rate limited: {e}") from e
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
