/**
 * Generic debounce helper.
 *
 * Delays invoking `fn` until `wait` ms have elapsed since the last call.
 * Supports leading/trailing edge invocation, plus `cancel()` and `flush()`
 * for manual control (e.g. cleanup on unmount, or forcing a final value).
 */
export type DebouncedFunction<T extends (...args: any[]) => void> = {
  (...args: Parameters<T>): void;
  cancel: () => void;
  flush: () => void;
};

export type DebounceOptions = {
  leading?: boolean; // invoke on the leading edge of the timeout
  trailing?: boolean; // invoke on the trailing edge of the timeout
};

export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  wait: number,
  options?: DebounceOptions,
): DebouncedFunction<T> {
  const { leading = false, trailing = true } = options ?? {};

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;
  let invokedOnLeadingEdge = false;

  const invoke = (args: Parameters<T>) => {
    fn(...args);
  };

  const debounced = (...args: Parameters<T>) => {
    lastArgs = args;

    const isNewBurst = timeoutId === null;

    if (isNewBurst && leading) {
      invokedOnLeadingEdge = true;
      invoke(args);
    } else {
      invokedOnLeadingEdge = false;
    }

    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      timeoutId = null;
      if (trailing && !invokedOnLeadingEdge && lastArgs) {
        invoke(lastArgs);
      }
      lastArgs = null;
      invokedOnLeadingEdge = false;
    }, wait);
  };

  debounced.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    lastArgs = null;
    invokedOnLeadingEdge = false;
  };

  debounced.flush = () => {
    if (timeoutId !== null && lastArgs) {
      clearTimeout(timeoutId);
      timeoutId = null;
      invoke(lastArgs);
      lastArgs = null;
      invokedOnLeadingEdge = false;
    }
  };

  return debounced;
}
