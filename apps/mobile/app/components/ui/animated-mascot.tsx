import { memo, useCallback, useEffect, useRef } from "react";
import { StyleProp, ViewStyle } from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import SkiaMascot from "./skia-mascot";

/**
 * How a mascot arrives once its animation has loaded: it grows in from a
 * little smaller than itself, easing out, as the fade finishes a touch sooner.
 * Until then it isn't drawn at all — an empty slot that fills in beats a
 * frame of nothing and then a pop.
 */
const APPEAR = {
  fromScale: 0.72,
  scaleMs: 560,
  fadeMs: 280,
  /** A load event that never comes shows the mascot anyway, after this. */
  fallbackMs: 2500,
};

/**
 * A Lottie mascot wrapped in a Reanimated view.
 *
 * Drawn by `SkiaMascot` (Skottie on the UI thread, stopped off-screen), like
 * every other mascot in the app. This used to split between the dotLottie
 * runtime (for state machines) and lottie-ios (for plain loops); the dotLottie
 * path set its input only after the file loaded, so a cold first visit could
 * keep showing the machine's default pose. `SkiaMascot` settles the first
 * state from the inputs before it draws anything.
 *
 * Reanimated owns everything *outside* the mascot — scale and translation
 * driven by the shared `progress` value, with a per-mascot input range so
 * movement is staggered.
 */
export interface AnimatedMascotProps {
  source: number;
  /** Width in device points. */
  size: number;
  /** Defaults to `size` (square). Pass it for a non-square canvas. */
  height?: number;
  /** Absolute initial layout (position + width/height). */
  position: StyleProp<ViewStyle>;
  progress: SharedValue<number>;
  targetScale?: number;
  targetDx?: number;
  targetDy?: number;
  /** Portion of the transition this mascot reacts to. */
  inputRange?: [number, number];
  zIndex?: number;
  /** Set for files driven by their state machine. The machine itself is the
   *  file's own (every mascot carries one); this only says it has inputs. */
  stateMachineId?: string;
  stateMachineInput?: string;
  stateMachineValue?: boolean;
  /** Stops playback while the screen is off-screen. */
  paused?: boolean;
  /** Holds the entrance this long after loading, to stagger a group. */
  appearDelay?: number;
  /** TEMP profiling hook. */
  onLoaded?: () => void;
}

export default memo(function AnimatedMascot({
  source,
  size,
  height = size,
  position,
  progress,
  targetScale = 1,
  targetDx = 0,
  targetDy = 0,
  inputRange = [0, 1],
  zIndex,
  stateMachineId,
  stateMachineInput,
  stateMachineValue = true,
  paused = false,
  appearDelay = 0,
  onLoaded,
}: AnimatedMascotProps) {
  const usesStateMachine = Boolean(stateMachineId && stateMachineInput);

  // 0 until the animation has loaded, then eased to 1 once.
  const appear = useSharedValue(0);
  const appeared = useRef(false);
  const reveal = useCallback(() => {
    if (appeared.current) return;
    appeared.current = true;
    appear.set(
      withDelay(
        appearDelay,
        withTiming(1, {
          duration: APPEAR.scaleMs,
          easing: Easing.out(Easing.back(1.15)),
        }),
      ),
    );
  }, [appear, appearDelay]);
  useEffect(() => {
    const timer = setTimeout(reveal, APPEAR.fallbackMs);
    return () => clearTimeout(timer);
  }, [reveal]);

  const animatedStyle = useAnimatedStyle(() => {
    const p = interpolate(
      progress.value,
      inputRange,
      [0, 1],
      Extrapolation.CLAMP,
    );
    const grow = APPEAR.fromScale + (1 - APPEAR.fromScale) * appear.value;
    return {
      // The fade runs ahead of the scale, so the mascot is fully there while
      // it is still settling to size.
      opacity: Math.min(1, (appear.value * APPEAR.scaleMs) / APPEAR.fadeMs),
      transform: [
        { translateX: targetDx * p },
        { translateY: targetDy * p },
        { scale: (1 + (targetScale - 1) * p) * grow },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", zIndex }, position, animatedStyle]}
    >
      <SkiaMascot
        source={source}
        width={size}
        height={height}
        inputs={
          usesStateMachine
            ? { [stateMachineInput as string]: stateMachineValue }
            : undefined
        }
        // The decorative blobs always looped here, whatever their file says
        // (blob-purple's one state is marked play-once).
        loop={usesStateMachine ? undefined : true}
        paused={paused}
        onLoad={() => {
          reveal();
          onLoaded?.();
        }}
      />
    </Animated.View>
  );
});
