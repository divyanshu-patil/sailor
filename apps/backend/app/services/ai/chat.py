import logging
import random
import sys
import threading
import time
from concurrent.futures import Future, ThreadPoolExecutor
from typing import Callable, Iterable, Sequence, TypeVar

from app.config.settings import settings
from app.services.ai.providers import (
    ChatProvider,
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


def _complete_with_retry(
    provider, request: ChatRequest, model: str, retries: int = MAX_RATE_LIMIT_RETRIES
) -> str:
    """One model, retried for as long as it's only rate limiting us.

    `retries` is 0 when another provider is queued behind this one: waiting out
    a limit only makes sense when there is nothing else to ask.
    """
    last_error: RateLimitedError | None = None

    for attempt in range(retries + 1):
        try:
            with _limiter.slot():
                result = provider.complete(request, model)
        except RateLimitedError as e:
            _limiter.record_rate_limited()
            last_error = e
            if attempt == retries:
                break
            delay = _rate_limit_delay(attempt, e.retry_after)
            logger.info(
                f"[ai] {provider.name}:{model} rate limited, retrying in {delay:.1f}s "
                f"({attempt + 1}/{retries})"
            )
            time.sleep(delay)
            continue

        # Outside the slot: a success is what earns the limiter's way back up to
        # the ceiling after a period of backing off.
        _limiter.record_success()
        return result

    raise last_error if last_error else ProviderError("rate limited")


# ANSI colour, only when a terminal is watching — a log file gets plain text.
# Celery's own formatter colours by *level*; this colours by which provider
# answered, which is the thing being watched while the free tier is on.
_COLOR = sys.stderr.isatty()
_CODES = {"green": "32", "yellow": "33", "cyan": "36"}


def _paint(text: str, color: str) -> str:
    return f"\033[{_CODES[color]}m{text}\033[0m" if _COLOR else text


def _openrouter_expected() -> bool:
    """Whether OpenRouter should have taken this call. False and the configured
    provider is simply the primary, not a fallback — worth saying which."""
    return bool(settings.AI_USE_OPENROUTER and settings.OPENROUTER_API_KEY)


def _log_served(provider, model: str) -> None:
    if provider.name == "openrouter":
        logger.info(_paint(f"[ai] ● FREE      openrouter:{model}", "green"))
    elif _openrouter_expected():
        logger.info(_paint(f"[ai] ● FALLBACK  {provider.name}:{model}", "yellow"))
    else:
        logger.info(_paint(f"[ai] ● {provider.name}:{model}", "cyan"))


# When OpenRouter's free budget is spent, every subsequent call would otherwise
# pay a doomed round trip before falling through. The first 429 parks it and the
# configured provider answers alone until the window is up.
#
# ponytail: per process, like the limiter above — each Celery worker discovers
# the limit once for itself. Shared state in Redis if that ever costs more than
# it saves.
_openrouter_ready_at = 0.0
_breaker_lock = threading.Lock()

# Shortest useful park. See _park_openrouter.
MIN_PARK_SECONDS = 5.0


def _park_openrouter(retry_after: float | None, reason: str = "rate limited") -> None:
    global _openrouter_ready_at
    # Floored: a reset header can point at a timestamp that has already passed,
    # and a 0s park is no park at all — the fan-out just walks straight back
    # into the limit on the next call.
    delay = max(
        retry_after if retry_after is not None else settings.OPENROUTER_COOLDOWN_SECONDS,
        MIN_PARK_SECONDS,
    )
    with _breaker_lock:
        _openrouter_ready_at = max(_openrouter_ready_at, time.monotonic() + delay)
    logger.warning(
        _paint(
            f"[ai] ⇄ SWITCH  openrouter {reason} → {settings.AI_PROVIDER} "
            f"for the next {delay:.0f}s",
            "yellow",
        )
    )


def _openrouter_parked() -> bool:
    """True while OpenRouter is being skipped. Announces the moment it isn't —
    a silent recovery leaves the log saying "switched to ollama" and nothing
    ever taking it back."""
    global _openrouter_ready_at
    with _breaker_lock:
        if not _openrouter_ready_at:
            return False
        if time.monotonic() < _openrouter_ready_at:
            return True
        _openrouter_ready_at = 0.0
    logger.info(_paint("[ai] ⇄ SWITCH  cooldown over → openrouter free tier", "green"))
    return False


def provider_chain() -> list[ChatProvider]:
    """Providers to try, in order: free first, configured behind it.

    OpenRouter is only ever a prefix to the existing path — drop it (flag off,
    no key, no free model configured, or currently parked) and what's left is
    exactly the provider this app used before.
    """
    chain: list[ChatProvider] = []
    if (
        settings.AI_USE_OPENROUTER
        and settings.OPENROUTER_API_KEY
        and not _openrouter_parked()
    ):
        free = get_provider("openrouter")
        if free.models():
            chain.append(free)

    configured = get_provider()
    if not any(p.name == configured.name for p in chain):
        chain.append(configured)
    return chain


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
    request = ChatRequest(
        *_split_system(messages),
        images=tuple(images)[:MAX_IMAGES_PER_REQUEST],
        fast=settings.AI_FAST if fast is None else fast,
    )

    chain = provider_chain()
    last_error: Exception | None = None

    for index, provider in enumerate(chain):
        has_fallback = index < len(chain) - 1
        models = provider.models()
        if not models:
            last_error = last_error or ModelCallError(
                f"No models configured for {provider.name} — set AI_MODEL."
            )
            continue

        for model in models:
            try:
                content = _complete_with_retry(
                    provider,
                    request,
                    model,
                    retries=0 if has_fallback else MAX_RATE_LIMIT_RETRIES,
                )
                _log_served(provider, model)
                return content
            except RateLimitedError as e:
                if provider.name == "openrouter":
                    _park_openrouter(e.retry_after)
                last_error = e
                if has_fallback:
                    # The limit is on the account, not the model, so the sibling
                    # model draws on the same exhausted budget — skip straight to
                    # the next provider.
                    break
                # Nothing left behind this one. Still limited after backing off,
                # so stop and let the task's own retry pick it up once the burst
                # has cleared.
                logger.warning(f"[ai] {provider.name}:{model} still rate limited, giving up")
                raise ModelCallError(f"{provider.name} rate limited: {e}") from e
            except Exception as e:  # ProviderError, or anything an adapter missed
                logger.warning(f"[ai] {provider.name}:{model} failed: {e}")
                last_error = e
        else:
            # Every model refused, and not over a rate limit — a retired id, a
            # privacy setting, an outage. Whatever it is, it won't have fixed
            # itself by the next beat, and asking anyway adds a doomed round
            # trip to every call in the fan-out.
            if provider.name == "openrouter" and has_fallback:
                _park_openrouter(None, reason="unavailable")

    names = " -> ".join(p.name for p in chain) or "none"
    raise ModelCallError(f"All models failed ({names}). Last error: {last_error}")


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
