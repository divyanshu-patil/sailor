import { useCallback, useEffect } from "react";
import {
  appearanceService,
  AppearanceOption,
} from "@/services/appearance.debug.service";
// Swap to "./appearance.debug.service" while the backend endpoint isn't live yet.
import { useApiState, UseApiStateReturn } from "./use-api-state";

export interface UseAppearanceOptionsOptions {
  initialData?: AppearanceOption[];
  onError?: (error: Error) => void;
  retryCount?: number;
  retryDelay?: number;
  immediate?: boolean;
}

export interface UseAppearanceOptionsReturn extends UseApiStateReturn<
  AppearanceOption[]
> {
  fetchOptions: () => Promise<void>;
}

/**
 * Owns loading the list of available appearance options.
 * No mutation surface — this data is read-only from the client's perspective.
 */
export function useAppearanceOptions(
  options: UseAppearanceOptionsOptions = {},
): UseAppearanceOptionsReturn {
  const {
    initialData,
    onError,
    retryCount = 1,
    retryDelay = 1000,
    immediate = true,
  } = options;

  const state = useApiState<AppearanceOption[]>({
    initialData,
    onError,
    retryCount,
    retryDelay,
  });
  const { execute } = state;

  const fetchOptions = useCallback(async () => {
    await execute(appearanceService.getOptions());
  }, [execute]);

  useEffect(() => {
    if (immediate) fetchOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [immediate]);

  return { ...state, refresh: fetchOptions, fetchOptions };
}
