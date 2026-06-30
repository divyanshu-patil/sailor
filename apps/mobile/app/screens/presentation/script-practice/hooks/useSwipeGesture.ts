import { Dimensions } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import { SharedValue, withSpring, withTiming } from "react-native-reanimated";
import { SpringConfig } from "react-native-reanimated/lib/typescript/animation/spring";
import { scheduleOnRN } from "react-native-worklets";

const SETTLE_SPRING: SpringConfig = { damping: 70, mass: 1 };
export const RIGHT_SWIPE_THRESHOLD = 200;
export const LEFT_SWIPE_THRESHOLD = 250;
export const SWIPE_THRESHOLD = RIGHT_SWIPE_THRESHOLD + LEFT_SWIPE_THRESHOLD / 2;
const SCREEN_WIDTH = Dimensions.get("window").width;
const RETURN_START_X = SCREEN_WIDTH * 1.5;
const RETREAT_SPRING = { damping: 22, stiffness: 250, mass: 0.6 };

type SwipeDirection = "left" | "right" | null;

interface UseSwipeGestureParams {
  cardsLength: number;
  currentIndexSV: SharedValue<number>;
  translateX: SharedValue<number>;
  dragX: SharedValue<number>;
  translateY: SharedValue<number>;
  swipeDirection: SharedValue<SwipeDirection>;
  prevCardX: SharedValue<number>;
  prevCardY: SharedValue<number>;
  prevCardOpacity: SharedValue<number>;
  isAnimating: SharedValue<boolean>;
  isRetreating: SharedValue<boolean>;
  onAdvance: () => void;
  onRetreat: () => void;
}

/**
 * Handles right-swipe drag tracking: updates translateX/Y directly and
 * hides the "previous card" preview since it's not relevant on this side.
 */
const handleRightSwipeUpdate = (
  e: { translationX: number; translationY: number },
  params: Pick<
    UseSwipeGestureParams,
    "translateX" | "translateY" | "prevCardOpacity" | "prevCardX" | "dragX"
  >,
) => {
  "worklet";
  params.translateX.value = e.translationX;
  params.translateY.value = e.translationY;
  params.dragX.value = Math.min(
    Math.abs(e.translationX) / RIGHT_SWIPE_THRESHOLD,
    1,
  );
  params.prevCardOpacity.value = withTiming(0, { duration: 80 });
  params.prevCardX.value = RETURN_START_X;
};

/**
 * Handles left-swipe drag tracking: updates translateX and, if there's a
 * previous card to return, animates its return-progress based on drag
 * distance relative to the left swipe threshold.
 */
const handleLeftSwipeUpdate = (
  e: { translationX: number },
  params: Pick<
    UseSwipeGestureParams,
    | "translateX"
    | "translateY"
    | "currentIndexSV"
    | "prevCardX"
    | "dragX"
    | "prevCardY"
    | "prevCardOpacity"
  >,
) => {
  "worklet";
  params.translateX.value = e.translationX;
  params.translateY.value = 0;
  params.dragX.value = Math.min(
    Math.abs(e.translationX) / LEFT_SWIPE_THRESHOLD,
    1,
  );

  if (params.currentIndexSV.value > 0) {
    const progress = Math.abs(e.translationX) / LEFT_SWIPE_THRESHOLD;
    const clampedProgress = Math.min(progress, 1);
    params.prevCardX.value =
      RETURN_START_X * (1 - clampedProgress) - Math.max(0, progress - 1) * 40;
    params.prevCardOpacity.value = clampedProgress;
    params.prevCardY.value = (clampedProgress - 1) * 50;
  }
};

/**
 * On release after a right swipe: either commit the advance (animate card
 * off-screen, then call onAdvance) or settle back to center.
 */
const handleRightSwipeEnd = (
  params: Pick<
    UseSwipeGestureParams,
    | "translateX"
    | "translateY"
    | "prevCardOpacity"
    | "currentIndexSV"
    | "dragX"
    | "cardsLength"
    | "isAnimating"
    | "onAdvance"
  >,
) => {
  "worklet";
  const didExceedThreshold =
    params.translateX.value > RIGHT_SWIPE_THRESHOLD &&
    params.currentIndexSV.value < params.cardsLength;

  params.dragX.value = 0;

  if (didExceedThreshold) {
    params.isAnimating.value = true;
    params.translateX.value = withTiming(
      SCREEN_WIDTH * 1.5,
      { duration: 250 },
      (finished) => {
        if (finished) scheduleOnRN(params.onAdvance);
      },
    );
  } else {
    params.translateX.value = withSpring(0, SETTLE_SPRING);
    params.translateY.value = withSpring(0, SETTLE_SPRING);
    params.prevCardOpacity.value = withTiming(0, { duration: 120 });
  }
};

/**
 * On release after a left swipe: either commit the retreat (spring the
 * previous card into place, then call onRetreat) or settle/return both
 * cards back to their resting positions.
 */
const handleLeftSwipeEnd = (
  translationX: number,
  params: Pick<
    UseSwipeGestureParams,
    | "translateX"
    | "translateY"
    | "prevCardX"
    | "prevCardY"
    | "dragX"
    | "prevCardOpacity"
    | "currentIndexSV"
    | "isAnimating"
    | "isRetreating"
    | "onRetreat"
  >,
) => {
  "worklet";
  const didExceedThreshold =
    Math.abs(translationX) > LEFT_SWIPE_THRESHOLD &&
    params.currentIndexSV.value > 0;

  params.dragX.value = 0;

  if (didExceedThreshold) {
    params.isAnimating.value = true;
    params.isRetreating.value = true;
    params.prevCardX.value = withSpring(0, RETREAT_SPRING, (finished) => {
      if (finished) scheduleOnRN(params.onRetreat);
    });
    params.prevCardY.value = withSpring(0, RETREAT_SPRING);
    params.prevCardOpacity.value = 1;
  } else {
    params.translateX.value = withTiming(0);
    params.translateY.value = withTiming(0);
    params.prevCardX.value = withTiming(RETURN_START_X);
    params.prevCardOpacity.value = withTiming(0, { duration: 100 });
  }
};

/**
 * Builds the pan gesture driving the swipeable card stack. Logic is
 * identical to the original inline Gesture.Pan() — only reorganized into
 * named worklet helpers above.
 */
export const useSwipeGesture = ({
  cardsLength,
  currentIndexSV,
  translateX,
  dragX,
  translateY,
  swipeDirection,
  prevCardX,
  prevCardY,
  prevCardOpacity,
  isAnimating,
  isRetreating,
  onAdvance,
  onRetreat,
}: UseSwipeGestureParams) => {
  return Gesture.Pan()
    .onUpdate((e) => {
      if (isAnimating.value) return;
      if (e.translationX >= 0) {
        swipeDirection.value = "right";
        handleRightSwipeUpdate(e, {
          translateX,
          translateY,
          prevCardOpacity,
          prevCardX,
          dragX,
        });
      } else {
        swipeDirection.value = "left";
        handleLeftSwipeUpdate(e, {
          translateX,
          translateY,
          currentIndexSV,
          prevCardX,
          dragX,
          prevCardY,
          prevCardOpacity,
        });
      }
    })
    .onEnd((e) => {
      if (isAnimating.value) return;
      if (swipeDirection.value === "right") {
        handleRightSwipeEnd({
          translateX,
          translateY,
          prevCardOpacity,
          currentIndexSV,
          cardsLength,
          dragX,

          isAnimating,
          onAdvance,
        });
      } else if (swipeDirection.value === "left") {
        handleLeftSwipeEnd(e.translationX, {
          translateX,
          translateY,
          prevCardX,
          prevCardY,
          prevCardOpacity,
          dragX,
          currentIndexSV,
          isAnimating,
          isRetreating,
          onRetreat,
        });
      }

      swipeDirection.value = null;
    });
};
