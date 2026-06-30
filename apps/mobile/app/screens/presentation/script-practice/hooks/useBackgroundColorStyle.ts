import {
  interpolateColor,
  SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import { SCREEN_WIDTH, RETURN_START_X } from "../constants";

type SwipeDirection = "left" | "right" | null;

interface UseBackgroundColorStyleParams {
  translateX: SharedValue<number>;
  prevCardX: SharedValue<number>;
  prevCardOpacity: SharedValue<number>;
  swipeDirection: SharedValue<SwipeDirection>;
  isRetreating: SharedValue<boolean>;
  currentColor: string;
  nextColor: string;
  prevColor: string;
}

/**
 * Drives the screen's background color crossfade as the user swipes:
 * right swipe crossfades current -> next color, left swipe (or an
 * in-progress retreat) crossfades current -> previous color.
 * Logic identical to the original inline animatedScreenStyle.
 */
export const useBackgroundColorStyle = ({
  translateX,
  prevCardX,
  prevCardOpacity,
  swipeDirection,
  isRetreating,
  currentColor,
  nextColor,
  prevColor,
}: UseBackgroundColorStyleParams) => {
  return useAnimatedStyle(() => {
    // right swipe: translateX goes 0 -> SCREEN_WIDTH*1.5 while card exits
    const rightProgress = Math.min(
      Math.max(translateX.value, 0) / SCREEN_WIDTH,
      1,
    );

    if (
      isRetreating.value ||
      (swipeDirection.value === "left" && prevCardOpacity.value > 0)
    ) {
      const leftProgress =
        1 - Math.min(Math.max(prevCardX.value, 0) / RETURN_START_X, 1);
      return {
        backgroundColor: interpolateColor(
          leftProgress,
          [0, 1],
          [currentColor, prevColor],
        ),
      };
    }

    return {
      backgroundColor: interpolateColor(
        rightProgress,
        [0, 1],
        [currentColor, nextColor],
      ),
    };
  });
};
