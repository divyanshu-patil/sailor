import logging
from concurrent.futures import Future, ThreadPoolExecutor
from typing import Callable, Iterable, TypeVar

from ollama import ResponseError

from app.config.settings import settings
from app.services.ai.ollama_client import get_ollama_client

logger = logging.getLogger("celery")

T = TypeVar("T")


class ModelCallError(Exception):
    """Raised when no configured model could answer a single call."""


def models_to_try() -> list[str]:
    return [m for m in (settings.OLLAMA_MODEL, settings.OLLAMA_FALLBACK_MODEL) if m]


# Models that have no reasoning mode reject the `think` parameter outright
# rather than ignoring it. Matched on the error text because Ollama reports it as
# a generic 400 — there's no distinct status code to key off.
_THINK_UNSUPPORTED_MARKERS = ("think", "thinking")

# Models already known to reject `think`, so the cost of discovering it is paid
# once per process instead of on every call. Keyed by model name; a set is enough
# because the answer never changes for a given model.
_no_think_models: set[str] = set()


def _chat_once(client, model: str, messages: list[dict], *, think: bool | None) -> str:
    kwargs: dict = {"model": model, "messages": messages, "stream": False}
    if think is not None:
        kwargs["think"] = think
    response = client.chat(**kwargs)
    content = (response.get("message", {}) or {}).get("content", "").strip()
    if not content:
        raise ModelCallError(f"Model '{model}' returned empty content")
    return content


def chat(messages: list[dict], *, client=None) -> str:
    """
    One model call, primary model first and the fallback behind it.

    `think` is passed explicitly rather than left to the model's default. The
    configured models reason before answering, and a script is a dozen-odd calls
    — so the thinking budget gets paid a dozen times and is the single largest
    contributor to how long a generation takes. See settings.OLLAMA_THINK.

    A model with no reasoning mode rejects the parameter instead of ignoring it,
    which would otherwise take down every model at once and fail the whole
    generation. Such a model is retried immediately without it and remembered, so
    turning thinking off can only ever make things faster, never break them.

    Every caller creates its own client by default: these run concurrently now,
    and sharing one connection pool across a fan-out is a needless coupling
    between calls that have nothing to do with each other.
    """
    active_client = client or get_ollama_client()
    last_error: Exception | None = None

    for model in models_to_try():
        think = None if model in _no_think_models else settings.OLLAMA_THINK
        try:
            return _chat_once(active_client, model, messages, think=think)
        except ResponseError as e:
            detail = f"{e.error}".lower()
            if think is not None and any(m in detail for m in _THINK_UNSUPPORTED_MARKERS):
                logger.info(f"[ai] '{model}' doesn't accept `think`; retrying without it")
                _no_think_models.add(model)
                try:
                    return _chat_once(active_client, model, messages, think=None)
                except Exception as retry_error:
                    logger.warning(f"[ai] '{model}' failed without `think`: {retry_error}")
                    last_error = retry_error
                    continue
            logger.warning(f"[ai] '{model}' failed ({e.status_code}): {e.error}")
            last_error = e
        except Exception as e:  # network errors, timeouts, empty content
            logger.warning(f"[ai] '{model}' failed: {e}")
            last_error = e

    raise ModelCallError(f"All models failed. Last error: {last_error}")


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

    max_workers = max(1, min(len(work), settings.OLLAMA_MAX_CONCURRENCY))
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures: list[Future] = [pool.submit(fn, item) for item in work]
        try:
            return [future.result() for future in futures]
        except Exception:
            for future in futures:
                future.cancel()
            raise
