import { useEffect, useState } from "react";
import { usePreferenceStore } from "@/store/preference-store";
import { syncAppearanceOptions } from "@/services/appearance-sync.service";
import { AppearanceOption } from "@/types/settings/preferences";

export interface UseAppearanceOptionsReturn {
  data: AppearanceOption[] | undefined;
  isLoading: boolean;
}

export function useAppearanceOptions(): UseAppearanceOptionsReturn {
  const appearanceOptions = usePreferenceStore(
    (state) => state.appearanceOptions,
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    syncAppearanceOptions().finally(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data: appearanceOptions, isLoading };
}
