import { useEffect, useRef } from "react";
import {
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

export const useIntroAnimation = (ready: boolean) => {
  const introRotation = useSharedValue(10);
  const introScale = useSharedValue(0.5);
  const introOpacity = useSharedValue(0);
  const hasPlayed = useRef(false);

  useEffect(() => {
    if (!ready || hasPlayed.current) return;
    hasPlayed.current = true;

    introRotation.value = withDelay(
      100,
      withSequence(
        withTiming(8, { duration: 180 }),
        withTiming(-6, { duration: 160 }),
        withSpring(0, { damping: 70, mass: 1 }),
      ),
    );
    introScale.value = withDelay(
      100,
      withSpring(1, {
        damping: 50,
      }),
    );
    introOpacity.value = withDelay(100, withTiming(1, { duration: 220 }));
  }, [ready, introRotation, introScale, introOpacity]);

  return { introRotation, introScale, introOpacity };
};
