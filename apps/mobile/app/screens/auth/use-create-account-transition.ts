import { useCallback, useRef, useState } from "react";
import {
  Easing,
  runOnJS,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

export type ScreenMode = "base" | "create-account";

/**
 * Single source of truth for the onboarding <-> create-account morph.
 *
 * `screenMode` drives which controls are interactive and the cream mascot's
 * `isNamaste` input; `progress` is the one driver every animated value reads
 * from, so the whole screen moves (and reverses) as one coordinated system.
 *
 * A single lock prevents duplicate forward/backward transitions, and there is
 * exactly one place that writes to `progress` so the two directions can never
 * fight over it.
 */
export function useCreateAccountTransition(
  forwardDuration = 1200,
  backDuration = 900,
) {
  const [screenMode, setScreenMode] = useState<ScreenMode>("base");
  const progress = useSharedValue(0);
  const lockedRef = useRef(false);

  const release = useCallback((mode: ScreenMode) => {
    lockedRef.current = false;
    setScreenMode(mode);
  }, []);

  const animateTo = useCallback(
    (target: 0 | 1, duration: number, mode: ScreenMode) => {
      progress.value = withTiming(
        target,
        { duration, easing: Easing.inOut(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(release)(mode);
        },
      );
    },
    // `progress` is a stable Reanimated shared value, so it is intentionally
    // left out of the dependency list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [release],
  );

  const startTransition = useCallback(() => {
    if (lockedRef.current) return;
    lockedRef.current = true;
    // Enter create-account immediately: base controls stop receiving touches
    // and `isNamaste` flips false while the mascot is still moving.
    setScreenMode("create-account");
    animateTo(1, forwardDuration, "create-account");
  }, [animateTo, forwardDuration]);

  const goBack = useCallback(() => {
    if (lockedRef.current) return;
    lockedRef.current = true;
    // Play the reverse morph first, then flip to base. `isNamaste` returns to
    // true when the mode flips, so the mascot greets again via its own machine.
    animateTo(0, backDuration, "base");
  }, [animateTo, backDuration]);

  return { screenMode, progress, startTransition, goBack };
}
