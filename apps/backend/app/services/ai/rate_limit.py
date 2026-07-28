import logging
import threading
import time
from contextlib import contextmanager

logger = logging.getLogger("celery")

# Never throttle below this. One call at a time is slow, but it's the only floor
# that always makes forward progress.
MIN_LIMIT = 1

# A rate-limited fan-out gets rate-limited on every branch at once. Without a
# cooldown, twelve simultaneous 429s would halve the limit twelve times over and
# collapse it to the floor for what is really one event.
DECREASE_COOLDOWN_SECONDS = 5.0

# Consecutive successes before opening one more slot. Recovery is deliberately
# slower than the backoff: re-expanding as fast as we contracted just walks
# straight back into the limit.
SUCCESSES_PER_INCREASE = 5


class AdaptiveLimiter:
    """
    Caps concurrent provider calls, and tunes that cap to what the provider is
    actually accepting right now.

    The alternative was a fixed, lower ceiling — but a static number is wrong in
    both directions: too low and every generation is needlessly serialised, too
    high and it takes 429s. This keeps the configured maximum as the *ceiling*
    and only backs off while the provider is complaining, then climbs back.

    Additive-increase / multiplicative-decrease, the same shape TCP uses for
    congestion: halve on the first sign of trouble, recover one slot at a time.
    Fast to get out of the provider's way, slow to crowd it again.

    Per process. Celery's prefork pool gives each worker its own, so the true
    ceiling is this times the worker concurrency — each one converges on its own
    share of whatever the account actually allows.
    """

    def __init__(self, max_permits: int):
        self._max = max(MIN_LIMIT, max_permits)
        self._limit = self._max
        self._active = 0
        self._successes = 0
        self._last_decrease = 0.0
        self._condition = threading.Condition()

    @property
    def limit(self) -> int:
        return self._limit

    @contextmanager
    def slot(self):
        """Blocks until a slot is free, holds one for the duration of the call."""
        with self._condition:
            while self._active >= self._limit:
                self._condition.wait()
            self._active += 1
        try:
            yield
        finally:
            with self._condition:
                self._active -= 1
                self._condition.notify()

    def record_rate_limited(self) -> None:
        """Called on a 429. Halves the limit, at most once per cooldown."""
        with self._condition:
            now = time.monotonic()
            if now - self._last_decrease < DECREASE_COOLDOWN_SECONDS:
                return
            self._last_decrease = now
            self._successes = 0
            previous = self._limit
            self._limit = max(MIN_LIMIT, self._limit // 2)
            if self._limit != previous:
                logger.info(
                    f"[ai] rate limited — concurrency {previous} -> {self._limit} "
                    f"(ceiling {self._max})"
                )

    def record_success(self) -> None:
        """Called on every completed call. Reopens a slot after a clean run."""
        with self._condition:
            if self._limit >= self._max:
                return
            self._successes += 1
            if self._successes < SUCCESSES_PER_INCREASE:
                return
            self._successes = 0
            self._limit += 1
            logger.info(f"[ai] recovered — concurrency raised to {self._limit}")
            # One more slot became available, so one waiter can proceed.
            self._condition.notify()
