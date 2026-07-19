import { useCallback, useEffect, useRef } from "react";
import {
  EditablePreferences,
  preferencesService,
  UserPreferences,
} from "@/services/preferences.service";
import { usePreferenceStore } from "@/store/preference-store";
import { useApiMutation } from "./use-api-state";
import { syncPreferences } from "@/services/preferences-sync.service";

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
  createPreference: (initial: EditablePreferences) => Promise<void>;
}

export function usePreferences(
  options: UsePreferencesOptions = {},
): UsePreferencesReturn {
  const { onSync, onError } = options;
  const store = usePreferenceStore();
  const hasSyncedRef = useRef(false);

  const { mutate, isMutating } = useApiMutation<EditablePreferences>({
    onError: (error) => onError?.(error as Error),
  });

  const hydrate = useCallback(async () => {
    if (hasSyncedRef.current) return;
    hasSyncedRef.current = true;

    try {
      await syncPreferences();
      onSync?.();
    } catch (error) {
      onError?.(error as Error);
    }
  }, [onSync, onError]);

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
          preferencesService.updatePreferences({ [key]: value } as any),
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

  const createPreference = useCallback(
    async (initial: EditablePreferences) => {
      try {
        const created = await mutate(
          preferencesService.createPreferences(initial),
        );
        store.setPreferences({ ...store.preferences, ...created });
        onSync?.();
      } catch (error) {
        onError?.(error as Error);
        throw error;
      }
    },
    [store, mutate, onSync, onError],
  );

  return { isLoading: isMutating, updatePreference, createPreference };
}
