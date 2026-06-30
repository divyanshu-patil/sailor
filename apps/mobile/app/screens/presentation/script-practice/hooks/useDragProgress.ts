import {
  SharedValue,
  useDerivedValue,
  useSharedValue,
} from "react-native-reanimated";
import { LEFT_SWIPE_THRESHOLD, RIGHT_SWIPE_THRESHOLD } from "./useSwipeGesture";

export const useDragProgress = (
  translateX: SharedValue<number>,
  swipeDirection: SharedValue<"left" | "right" | null>,
) => {
  const lastDirection = useSharedValue<"left" | "right">("right");

  return useDerivedValue(() => {
    if (swipeDirection.value !== null) {
      lastDirection.value = swipeDirection.value;
    }
    const threshold =
      lastDirection.value === "left"
        ? LEFT_SWIPE_THRESHOLD
        : RIGHT_SWIPE_THRESHOLD;
    return Math.min(Math.abs(translateX.value) / threshold, 1);
  });
};
