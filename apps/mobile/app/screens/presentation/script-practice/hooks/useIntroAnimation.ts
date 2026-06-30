import { useEffect } from "react";
import {
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

export const useIntroAnimation = () => {
  const introRotation = useSharedValue(10);
  const introScale = useSharedValue(0.5);

  useEffect(() => {
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
  }, [introRotation, introScale]);

  return { introRotation, introScale };
};
