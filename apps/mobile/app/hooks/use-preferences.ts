import { useCallback, useEffect, useRef } from "react";
import {
  preferencesService,
  UserPreferences,
} from "@/services/preferences.debug.service";
import { usePreferenceStore } from "@/store/preference-store";
import { useApiMutation } from "./use-api-state";

export interface UsePreferencesOptions {
  onSync?: () => void;
  onError?: (error: Error) => void;
}

export interface UsePreferencesReturn {
  isLoading: boolean;
  updatePreference: <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K],
  ) => Promise<void>;
}

export function usePreferences(
  options: UsePreferencesOptions = {},
): UsePreferencesReturn {
  const { onSync, onError } = options;
  const store = usePreferenceStore();
  const hasSyncedRef = useRef(false);

  const { mutate, isMutating } = useApiMutation({
    onError: (error) => onError?.(error as Error),
  });

  const hydrate = useCallback(async () => {
    if (hasSyncedRef.current) return;
    hasSyncedRef.current = true;

    try {
      const serverPreferences = await preferencesService.getPreferences();
      store.setPreferences(serverPreferences);
      onSync?.();
    } catch (error) {
      onError?.(error as Error);
    }
  }, [store, onSync, onError]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const updatePreference = useCallback(
    async <K extends keyof UserPreferences>(
      key: K,
      value: UserPreferences[K],
    ) => {
      const previousValue = store.preferences[key];
      store.setPreference(key, value);

      try {
        await mutate(
          preferencesService.updatePreferences({
            [key]: value,
          } as Partial<UserPreferences>),
        );
        onSync?.();
      } catch (error) {
        store.setPreference(key, previousValue);
        onError?.(error as Error);
        throw error;
      }
    },
    [store, mutate, onSync, onError],
  );

  return { isLoading: isMutating, updatePreference };
}
