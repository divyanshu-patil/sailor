import { DotLottie, type Dotlottie } from "@lottiefiles/dotlottie-react-native";
import LottieView from "lottie-react-native";
import { memo, useEffect, useMemo, useRef } from "react";
import { Image, StyleProp, ViewStyle } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";

/**
 * A Lottie mascot wrapped in a Reanimated view.
 *
 * Two renderers, picked by whether the file needs its own state machine:
 *  - `stateMachineId` set -> the dotLottie runtime, which owns the machine.
 *  - otherwise -> lottie-react-native (lottie-ios), a plain looping animation.
 *
 * The split matters on iOS: every dotLottie instance owns a private `MTKView`
 * plus a `CIContext`/command queue and renders a `CGImage` on the main thread
 * every frame. This screen shows seven mascots, so keeping the six decorative
 * ones on lottie-ios (Core Animation, GPU-composited, no per-frame main-thread
 * work) is what keeps the screen at 60fps.
 *
 * In both cases Reanimated owns everything *outside* the mascot — scale and
 * translation driven by the shared `progress` value, with a per-mascot input
 * range so movement is staggered.
 */
export interface AnimatedMascotProps {
  source: number;
  /** Square side in device points. */
  size: number;
  /** Absolute initial layout (position + width/height). */
  position: StyleProp<ViewStyle>;
  progress: SharedValue<number>;
  targetScale?: number;
  targetDx?: number;
  targetDy?: number;
  /** Portion of the transition this mascot reacts to. */
  inputRange?: [number, number];
  zIndex?: number;
  /** When set, the lottie state machine is used instead of loop/autoplay. */
  stateMachineId?: string;
  stateMachineInput?: string;
  stateMachineValue?: boolean;
  /** Stops playback while the screen is off-screen. */
  paused?: boolean;
}

export default memo(function AnimatedMascot({
  source,
  size,
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
}: AnimatedMascotProps) {
  const dotLottieRef = useRef<Dotlottie>(null);
  const lottieRef = useRef<LottieView>(null);
  const usesStateMachine = Boolean(stateMachineId && stateMachineInput);
  const lottieStyle = useMemo(() => ({ width: size, height: size }), [size]);

  // Resolve the bundled `.lottie` asset to a file URI for lottie-ios.
  const lottieSource = useMemo(
    () =>
      usesStateMachine
        ? undefined
        : { uri: Image.resolveAssetSource(source).uri },
    [usesStateMachine, source],
  );

  // Only set the input after the machine has loaded; the imperative handle is
  // null until then. `onLoad` below performs the initial set.
  useEffect(() => {
    if (!usesStateMachine) return;
    dotLottieRef.current?.stateMachineSetBooleanInput(
      stateMachineInput as string,
      stateMachineValue,
    );
  }, [usesStateMachine, stateMachineInput, stateMachineValue]);

  // Stop playback while the screen is off-screen. Skips the initial mount so it
  // never races autoplay / state-machine load.
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    if (usesStateMachine) {
      if (paused) {
        dotLottieRef.current?.stateMachineStop();
      } else {
        // Restarting the machine drops back to its initial state, so re-apply
        // the input that selects the current pose.
        dotLottieRef.current?.stateMachineStart();
        dotLottieRef.current?.stateMachineSetBooleanInput(
          stateMachineInput as string,
          stateMachineValue,
        );
      }
    } else {
      if (paused) lottieRef.current?.pause();
      else lottieRef.current?.resume();
    }
  }, [paused, usesStateMachine, stateMachineInput, stateMachineValue]);

  const animatedStyle = useAnimatedStyle(() => {
    const p = interpolate(
      progress.value,
      inputRange,
      [0, 1],
      Extrapolation.CLAMP,
    );
    return {
      transform: [
        { translateX: targetDx * p },
        { translateY: targetDy * p },
        { scale: 1 + (targetScale - 1) * p },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", zIndex }, position, animatedStyle]}
    >
      {usesStateMachine ? (
        <DotLottie
          ref={dotLottieRef}
          source={source}
          stateMachineId={stateMachineId}
          style={lottieStyle}
          // Load/start the machine here rather than relying on the prop setter:
          // the prop can land before the native view has built its animation, in
          // which case the load is a silent no-op and is never retried.
          onLoad={() => {
            dotLottieRef.current?.stateMachineLoad(stateMachineId as string);
            dotLottieRef.current?.stateMachineStart();
            dotLottieRef.current?.stateMachineSetBooleanInput(
              stateMachineInput as string,
              stateMachineValue,
            );
          }}
        />
      ) : (
        <LottieView
          ref={lottieRef}
          source={lottieSource}
          autoPlay
          loop
          style={lottieStyle}
        />
      )}
    </Animated.View>
  );
});
