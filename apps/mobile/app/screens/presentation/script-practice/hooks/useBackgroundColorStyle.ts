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
  currentIndexSV: SharedValue<number>;
  /** One colour per card, in deck order, already lightened for this surface. */
  colors: string[];
  /** Shown once the deck runs out, and used as the colour a swipe off the last
   *  card crossfades into. */
  fallbackColor: string;
}

/**
 * Drives the screen's background color crossfade as the user swipes:
 * right swipe crossfades current -> next color, left swipe (or an
 * in-progress retreat) crossfades current -> previous color.
 *
 * The three colours are looked up from `currentIndexSV` inside the worklet
 * rather than passed down from React state. Both endpoints of the crossfade
 * and the progress driving it then come from the same UI-thread frame: when
 * the deck advances, `currentIndexSV` and the drag offset move together, so
 * the background can never be painted with the new index's colours at the old
 * index's progress (a one-frame flash of the wrong colour).
 */
export const useBackgroundColorStyle = ({
  translateX,
  prevCardX,
  prevCardOpacity,
  swipeDirection,
  isRetreating,
  currentIndexSV,
  colors,
  fallbackColor,
}: UseBackgroundColorStyleParams) => {
  return useAnimatedStyle(() => {
    const index = currentIndexSV.value;
    const total = colors.length;
    const isExhausted = index >= total;

    const currentColor = isExhausted ? fallbackColor : colors[index];
    const nextColor =
      !isExhausted && index + 1 < total ? colors[index + 1] : fallbackColor;
    const prevColor =
      index - 1 >= 0 && index - 1 < total ? colors[index - 1] : currentColor;

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
