import { colord } from "colord";
import { usePreferenceStore } from "@/hooks";

export interface ProfileTheme {
  backgroundColor: string;
  backCircleColor: string;
  planCardColor: string;
  pillColor: string;
  textColor: string;
}

/**
 * Derives the profile screen's color palette from the user's chosen
 * appearance color. Keeping this in one place means any screen that
 * needs the same lighten/darken ramp can reuse it instead of
 * recomputing colord() calls inline.
 */
export function useProfileTheme(): ProfileTheme {
  const appearanceColor = usePreferenceStore(
    (state) => state.preferences.appearance.hex,
  );

  return {
    backgroundColor: colord(appearanceColor).lighten(0.4).toHex(),
    backCircleColor: colord(appearanceColor).lighten(0.32).toHex(),
    planCardColor: colord(appearanceColor).lighten(0.25).toHex(),
    pillColor: colord(appearanceColor).lighten(0.33).toHex(),
    textColor: colord(appearanceColor).darken(0.2).desaturate(0.35).toHex(),
  };
}
