import { Dimensions } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import { KeyboardController } from "react-native-keyboard-controller";
import { SharedValue, withSpring, withTiming } from "react-native-reanimated";
import { SpringConfig } from "react-native-reanimated/lib/typescript/animation/spring";
import { scheduleOnRN } from "react-native-worklets";

import { haptics, playCardHaptic } from "@/lib/haptics";

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
  /**
   * Impact tier (0..4) per card, in deck order — the same tier that chose the
   * card's colour, so what you feel and what you see cannot drift apart.
   * See `utils/colorAssignment`.
   */
  tiers: number[];
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
  /** Latches whether the live drag is past its commit distance, so the
   *  threshold tick fires on the crossing rather than on every frame beyond
   *  it. Owned by the screen, like every other shared value here. */
  crossed: SharedValue<boolean>;
  onAdvance: () => void;
  onRetreat: () => void;
}

/**
 * Handles right-swipe drag tracking: updates translateX/Y directly and
 * hides the "previous card" preview since it's not relevant on this side.
 */
/**
 * Fires the lightest tick in the vocabulary the moment a drag crosses (or
 * uncrosses) the distance that will commit on release.
 *
 * `crossed` latches, so this is once per crossing rather than once per frame —
 * an onUpdate runs at display rate, and a haptic per frame is a buzz, not a
 * cue. The point is to answer "is this far enough yet?" without the user
 * having to let go and find out.
 */
const tickOnThresholdCross = (
  distance: number,
  threshold: number,
  crossed: SharedValue<boolean>,
) => {
  "worklet";
  const isPast = distance > threshold;
  if (isPast === crossed.value) return;
  crossed.value = isPast;
  if (isPast) haptics.threshold();
};

const handleRightSwipeUpdate = (
  e: { translationX: number; translationY: number },
  params: Pick<
    UseSwipeGestureParams,
    | "translateX"
    | "translateY"
    | "prevCardOpacity"
    | "prevCardX"
    | "prevCardY"
    | "dragX"
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
  params.prevCardY.value = 0;
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
    | "tiers"
  >,
) => {
  "worklet";
  const pastDistance = params.translateX.value > RIGHT_SWIPE_THRESHOLD;
  const didExceedThreshold =
    pastDistance && params.currentIndexSV.value < params.cardsLength;

  params.dragX.value = 0;

  // Dragged far enough to commit, but there is no card left to go to. The
  // gesture springs back, and a dull stop says why — silence here reads as a
  // dropped swipe rather than the end of the deck.
  if (pastDistance && !didExceedThreshold) haptics.boundary();

  if (didExceedThreshold) {
    params.isAnimating.value = true;
    params.translateX.value = withTiming(
      SCREEN_WIDTH * 1.5,
      { duration: 250 },
      (finished) => {
        if (finished) {
          // Advance and clear the drag in one UI-thread write. Everything the
          // stack draws — card depth, cascade, background colour — reads both,
          // so they have to move together: hand the index to React first and
          // the frame it renders pairs the new depths with a drag offset still
          // parked off-screen, which is the flicker.
          params.currentIndexSV.value = Math.min(
            params.currentIndexSV.value + 1,
            params.cardsLength,
          );
          params.translateX.value = 0;
          params.translateY.value = 0;
          params.isAnimating.value = false;
          // The arriving card's weight, not the departing one's: this is the
          // line the user is about to say, and the whole point of grading it
          // is to warn the hand before the eye has finished reading.
          const arriving = params.currentIndexSV.value;
          if (arriving >= params.tiers.length) {
            // Off the end of the deck — the run is finished.
            haptics.successBig();
          } else {
            playCardHaptic(params.tiers[arriving] ?? 0);
          }
          scheduleOnRN(params.onAdvance);
        }
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
    | "tiers"
  >,
) => {
  "worklet";
  const pastDistance = Math.abs(translationX) > LEFT_SWIPE_THRESHOLD;
  const didExceedThreshold = pastDistance && params.currentIndexSV.value > 0;

  params.dragX.value = 0;

  // Already on the first card: the same dull stop as running off the end.
  if (pastDistance && !didExceedThreshold) haptics.boundary();

  if (didExceedThreshold) {
    params.isAnimating.value = true;
    params.isRetreating.value = true;
    params.prevCardX.value = withSpring(0, RETREAT_SPRING, (finished) => {
      if (finished) {
        // Same atomic hand-off as the advance above, in reverse: the returned
        // card becomes the front card and the retreat state is cleared in the
        // one write, before React hears about the new index.
        params.currentIndexSV.value = Math.max(
          params.currentIndexSV.value - 1,
          0,
        );
        params.prevCardX.value = RETURN_START_X;
        params.prevCardY.value = 0;
        params.prevCardOpacity.value = 0;
        params.translateX.value = 0;
        params.translateY.value = 0;
        params.isAnimating.value = false;
        params.isRetreating.value = false;
        // Same rule as advancing: the card now in hand is the one you feel.
        playCardHaptic(params.tiers[params.currentIndexSV.value] ?? 0);
        scheduleOnRN(params.onRetreat);
      }
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
  tiers,
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
  crossed,
  onAdvance,
  onRetreat,
}: UseSwipeGestureParams) => {
  return Gesture.Pan()
    .onStart(() => {
      crossed.value = false;
      scheduleOnRN(KeyboardController.dismiss);
    })
    .onUpdate((e) => {
      if (isAnimating.value) return;
      if (e.translationX >= 0) {
        swipeDirection.value = "right";
        tickOnThresholdCross(e.translationX, RIGHT_SWIPE_THRESHOLD, crossed);
        handleRightSwipeUpdate(e, {
          translateX,
          translateY,
          prevCardOpacity,
          prevCardX,
          prevCardY,
          dragX,
        });
      } else {
        swipeDirection.value = "left";
        tickOnThresholdCross(
          Math.abs(e.translationX),
          LEFT_SWIPE_THRESHOLD,
          crossed,
        );
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
          tiers,
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
          tiers,
          onRetreat,
        });
      }

      swipeDirection.value = null;
      crossed.value = false;
    });
};
