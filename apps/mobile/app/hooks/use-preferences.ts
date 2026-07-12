import { useCallback, useEffect } from "react";
import {
  preferencesService,
  UserPreferences,
} from "@/services/preferences.debug.service";
// Swap to "./preferences.debug.service" while the backend endpoint isn't live yet.
import { useApiState, UseApiStateReturn } from "./use-api-state";

export interface UsePreferencesOptions {
  initialData?: UserPreferences;
  onError?: (error: Error) => void;
  retryCount?: number;
  retryDelay?: number;
  immediate?: boolean;
}

export interface UsePreferencesReturn extends UseApiStateReturn<UserPreferences> {
  fetchPreferences: () => Promise<void>;
  updatePreference: <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K],
  ) => Promise<void>;
}

/**
 * Owns the user's preferences: fetching them and persisting field-level
 * updates optimistically (with rollback on failure). Any screen/section
 * that needs to read or change a preference goes through this hook —
 * never preferencesService directly.
 */
export function usePreferences(
  options: UsePreferencesOptions = {},
): UsePreferencesReturn {
  const {
    initialData,
    onError,
    retryCount = 3,
    retryDelay = 1000,
    immediate = true,
  } = options;

  const state = useApiState<UserPreferences>({
    initialData,
    onError,
    retryCount,
    retryDelay,
  });
  const { execute, setData } = state;

  const fetchPreferences = useCallback(async () => {
    await execute(preferencesService.getPreferences());
  }, [execute]);

  const updatePreference = useCallback(
    async <K extends keyof UserPreferences>(
      key: K,
      value: UserPreferences[K],
    ) => {
      let previous: UserPreferences[K] | undefined;
      setData((prev) => {
        if (!prev) return prev;
        previous = prev[key];
        return { ...prev, [key]: value };
      });

      try {
        await preferencesService.updatePreferences({
          [key]: value,
        } as Partial<UserPreferences>);
      } catch (err) {
        // Roll back the optimistic update on failure.
        setData((prev) =>
          prev ? { ...prev, [key]: previous as UserPreferences[K] } : prev,
        );
        onError?.(err as Error);
      }
    },
    [setData, onError],
  );

  useEffect(() => {
    if (immediate) fetchPreferences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [immediate]);

  return {
    ...state,
    refresh: fetchPreferences,
    fetchPreferences,
    updatePreference,
  };
}
