import { Extrapolation, interpolate } from "react-native-reanimated";

export const ROTATION_STEP = -8;
export const ROTATION_CYCLE = 3;
export const MAX_DRAG = 250;
export const ARC_HEIGHT = 50;
export const MAX_ROTATION = 18;

/**
 * Returns the cycling stack rotation for a given stacked-card index.
 * e.g. index 0 -> 0deg, 1 -> -8deg, 2 -> -16deg, 3 -> 0deg (cycle repeats)
 */
export const getRotation = (index: number) => {
  "worklet";
  return (index % ROTATION_CYCLE) * ROTATION_STEP;
};

/**
 * Horizontal drag progress, clamped to [-1, 1].
 * Negative = dragging left, positive = dragging right.
 */
export const getDragProgress = (translateX: number) => {
  "worklet";
  return interpolate(
    translateX,
    [-MAX_DRAG, 0, MAX_DRAG],
    [-1, 0, 1],
    Extrapolation.CLAMP,
  );
};

/**
 * Vertical "arc" offset that grows with drag distance in either direction.
 */
export const getArcY = (dragProgress: number) => {
  "worklet";
  return Math.abs(dragProgress) * ARC_HEIGHT;
};

/**
 * How far the previous (left-swiped-away) card has returned, as a 0->1
 * progress value used to drive the cascade of cards behind it.
 */
export const getPrevCardReturnProgress = (
  prevTranslateX: number,
  returnStartX: number,
) => {
  "worklet";
  return interpolate(
    prevTranslateX,
    [0, returnStartX],
    [1, 0],
    Extrapolation.CLAMP,
  );
};

/**
 * Combines the current card's own drag progress with the previous card's
 * return progress to produce a single cascade value driving how far stacked
 * cards should shift "forward" in the stack visually.
 */
export const getCascadeProgress = (
  dragProgress: number,
  prevCardReturnProgress: number,
) => {
  "worklet";
  return dragProgress >= 0 ? -dragProgress : prevCardReturnProgress;
};

/**
 * Interpolates the cycling stack rotation across a continuous "virtual depth"
 * (currIndex shifted by cascadeProgress), so cards smoothly rotate into the
 * next slot's rotation as the stack advances/retreats.
 */
export const getCascadedStackRotation = (virtualDepth: number) => {
  "worklet";
  return interpolate(
    virtualDepth,
    [0, 1, 2, 3],
    [getRotation(0), getRotation(1), getRotation(2), getRotation(3)],
    Extrapolation.CLAMP,
  );
};

/**
 * Full transform values for the "normal" (non-previous) card position,
 * given the gesture/cascade state. Returns translateX, translateY, and
 * rotate (all pre-intro-offset; caller adds introOffset/scale separately).
 */
export const getNormalCardTransform = ({
  currIndex,
  dragTranslateX,
  prevCardTranslateX,
  returnStartX,
}: {
  currIndex: number;
  dragTranslateX: number;
  prevCardTranslateX: number | undefined;
  returnStartX: number;
}) => {
  "worklet";
  const dragProgress = getDragProgress(dragTranslateX);
  const arcY = getArcY(dragProgress);

  const prevCardReturnProgress =
    prevCardTranslateX !== undefined
      ? getPrevCardReturnProgress(prevCardTranslateX, returnStartX)
      : 0;

  const cascadeProgress = getCascadeProgress(
    dragProgress,
    prevCardReturnProgress,
  );

  const virtualDepth = currIndex + cascadeProgress;
  const stackRotation = getCascadedStackRotation(virtualDepth);

  const isFrontCardDraggingRight = currIndex === 0 && dragProgress >= 0;

  const translateX = isFrontCardDraggingRight ? dragTranslateX : 0;
  const translateY = isFrontCardDraggingRight ? arcY : 0;
  const rotate = isFrontCardDraggingRight
    ? dragProgress * MAX_ROTATION
    : stackRotation;

  return { translateX, translateY, rotate };
};
