import { useCallback, useState } from "react";

export interface UseApiStateOptions<T> {
  /** Initial data to set */
  initialData?: T;
  /** Callback on successful fetch */
  onSuccess?: (data: T) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
  /** Number of retry attempts on failure */
  retryCount?: number;
  /** Delay between retries in ms */
  retryDelay?: number;
}

export interface UseApiStateReturn<T> {
  /** The data from the API */
  data: T | undefined;
  /** Whether a request is in progress (initial load) */
  isLoading: boolean;
  /** Whether a refresh request is in progress */
  isRefreshing: boolean;
  /** Whether a mutation request is in progress (create/update/delete) */
  isMutating: boolean;
  /** Error message if request failed */
  error: string | null;
  /** Execute a fetch operation */
  execute: (promise: Promise<T>) => Promise<T | undefined>;
  /** Refresh data by re-executing the last fetch */
  refresh: () => Promise<void>;
  /** Clear error state */
  clearError: () => void;
  /** Set data directly - accepts either a value or an updater function */
  setData: (data: T | ((prev: T | undefined) => T | undefined)) => void;
}

export interface UseApiStateMutateOptions {
  /** Callback on successful mutation */
  onSuccess?: () => void;
  /** Callback on error */
  onError?: (error: Error) => void;
  /** Whether to invalidate/re-fetch related data after mutation */
  invalidateOnSuccess?: boolean;
}

/**
 * Base hook for managing API state with loading, error, and retry handling.
 * This is the foundation for all API hooks in the application.
 */
export function useApiState<T>(
  options: UseApiStateOptions<T> = {},
): UseApiStateReturn<T> {
  const {
    initialData,
    onSuccess,
    onError,
    retryCount = 0,
    retryDelay = 1000,
  } = options;

  const [data, setData] = useState<T | undefined>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPromise, setLastPromise] = useState<(() => Promise<T>) | null>(
    null,
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const executeWithRetry = useCallback(
    async function attempt(promise: Promise<T>, retries: number): Promise<T> {
      try {
        return await promise;
      } catch (err) {
        if (retries > 0) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
          return attempt(promise, retries - 1);
        }
        throw err;
      }
    },
    [retryDelay],
  );

  const execute = useCallback(
    async (promise: Promise<T>): Promise<T | undefined> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await executeWithRetry(promise, retryCount);
        setData(result);
        onSuccess?.(result);
        return result;
      } catch (err: any) {
        const errorMessage =
          err?.response?.data?.message ||
          err?.message ||
          "An unexpected error occurred";
        setError(errorMessage);
        onError?.(err);
        return undefined;
      } finally {
        setIsLoading(false);
      }
    },
    [executeWithRetry, onSuccess, onError, retryCount],
  );

  const refresh = useCallback(async () => {
    if (!lastPromise) return;
    setIsRefreshing(true);
    setError(null);

    try {
      const result = await executeWithRetry(lastPromise(), retryCount);
      setData(result);
      onSuccess?.(result);
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.message || err?.message || "Failed to refresh";
      setError(errorMessage);
      onError?.(err);
    } finally {
      setIsRefreshing(false);
    }
  }, [lastPromise, executeWithRetry, onSuccess, onError, retryCount]);

  // Store the last promise for refresh
  const executeAndStore = useCallback(
    async (promise: Promise<T>): Promise<T | undefined> => {
      setLastPromise(() => () => promise);
      return execute(promise);
    },
    [execute],
  );

  return {
    data,
    isLoading,
    isRefreshing,
    isMutating,
    error,
    execute: executeAndStore,
    refresh,
    clearError,
    setData,
  };
}

/**
 * Hook specifically for mutation operations (create/update/delete)
 */
export function useApiMutation<T>(
  options: UseApiStateOptions<T> & UseApiStateMutateOptions = {},
) {
  const { onSuccess, onError, invalidateOnSuccess, ...apiOptions } = options;
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(
    async (promise: Promise<T>): Promise<T | undefined> => {
      setIsMutating(true);
      setError(null);

      try {
        const result = await promise;
        onSuccess?.();
        return result;
      } catch (err: any) {
        const errorMessage =
          err?.response?.data?.message ||
          err?.message ||
          "An unexpected error occurred";
        setError(errorMessage);
        onError?.(err);
        return undefined;
      } finally {
        setIsMutating(false);
      }
    },
    [onSuccess, onError],
  );

  return {
    isMutating,
    error,
    mutate,
    clearError: () => setError(null),
  };
}
