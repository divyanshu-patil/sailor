import { usePreferenceStore } from "@/store/preference-store";
import { AppearanceOption } from "@/types/settings/preferences";

export interface UseAppearanceOptionsReturn {
  data: AppearanceOption[] | undefined;
  isLoading: boolean;
}

export function useAppearanceOptions(): UseAppearanceOptionsReturn {
  const appearanceOptions = usePreferenceStore((state) => state.appearanceOptions);
  return { data: appearanceOptions, isLoading: false };
}