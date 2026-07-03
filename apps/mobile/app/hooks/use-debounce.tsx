/* eslint-disable react-hooks/refs */
import { useEffect, useMemo, useRef } from "react";
import {
  debounce,
  DebounceOptions,
  DebouncedFunction,
} from "../utils/debounce";

/**
 * React hook version of `debounce`.
 *
 * Returns a stable debounced function that always calls the *latest*
 * `fn` passed in on each render (no stale-closure bugs), without
 * resetting its pending timer on every re-render.
 *
 * Automatically cancels any pending invocation on unmount, or whenever
 * `wait`/`options` change (since those require a fresh debounce instance).
 *
 * @example
 * const debouncedOnChange = useDebouncedCallback(
 *   (value: number) => onChange?.(value),
 *   60,
 * );
 * // later: debouncedOnChange(value)
 * // debouncedOnChange.cancel() / debouncedOnChange.flush() also available
 */
export function useDebouncedCallback<T extends (...args: any[]) => void>(
  fn: T,
  wait: number,
  options?: DebounceOptions,
): DebouncedFunction<T> {
  // Always points at the latest `fn` so the debounced wrapper never goes
  // stale, even though the wrapper itself is only rebuilt when `wait` or
  // `options` change.
  const fnRef = useRef(fn);
  fnRef.current = fn;

  // Keep options stable-by-value so an inline `{ leading: true }` literal
  // passed on every render doesn't force a new debounce instance (which
  // would drop any pending trailing call).
  const leading = options?.leading ?? false;
  const trailing = options?.trailing ?? true;

  const debounced = useMemo(
    () =>
      debounce(
        (...args: Parameters<T>) => {
          fnRef.current(...args);
        },
        wait,
        { leading, trailing },
      ),
    [wait, leading, trailing],
  );

  // New `wait`/`options` means a new debounce instance above — make sure
  // the previous instance's pending timer doesn't linger.
  useEffect(() => {
    return () => {
      debounced.cancel();
    };
  }, [debounced]);

  return debounced;
}
