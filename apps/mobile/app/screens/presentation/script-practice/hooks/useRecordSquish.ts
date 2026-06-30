// hooks/useRecordButtonSquish.ts
import {
  useSharedValue,
  useAnimatedReaction,
  interpolate,
  withSpring,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";

const MAX_SCALEY = 1.1;
const MAX_SCALEX = 0.95;

export const useRecordButtonSquish = (dragX: SharedValue<number>) => {
  const scaleY = useSharedValue(1);
  const scaleX = useSharedValue(1);

  useAnimatedReaction(
    () => dragX.value,
    (current, previous) => {
      if (previous == null) return;

      const isResetting = current < (previous ?? 0);

      if (isResetting) {
        scaleY.value = withSpring(
          interpolate(current, [0, 1], [1, MAX_SCALEY]),
          { damping: 40 },
        );
        scaleX.value = withSpring(
          interpolate(current, [0, 1], [1, MAX_SCALEX]),
          { damping: 70 },
        );
      } else {
        scaleY.value = interpolate(current, [0, 1], [1, MAX_SCALEY]);
        scaleX.value = interpolate(current, [0, 1], [1, MAX_SCALEX]);
      }
    },
  );

  return { scaleX, scaleY };
};
