import { DotLottie, type Dotlottie } from "@lottiefiles/dotlottie-react-native";
import { useEffect, useRef } from "react";
import { StyleProp, ViewStyle } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";

/**
 * A DotLottie mascot wrapped in a Reanimated view.
 *
 * Responsibilities are deliberately split:
 *  - Lottie owns everything *inside* the mascot. If `stateMachineId` is given
 *    the file's own state machine drives playback and looping; we only set the
 *    boolean input. This component never seeks frames, never restarts the
 *    animation and never creates a playback loop.
 *  - Reanimated owns everything *outside*: scale and translation, driven by the
 *    shared `progress` value with a per-mascot input range so movement is
 *    staggered.
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
}

export default function AnimatedMascot({
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
}: AnimatedMascotProps) {
  const ref = useRef<Dotlottie>(null);
  const usesStateMachine = Boolean(stateMachineId && stateMachineInput);

  // Only set the input after the machine has loaded; the imperative handle is
  // null until then. `onLoad` below performs the initial set.
  useEffect(() => {
    if (!usesStateMachine) return;
    ref.current?.stateMachineSetBooleanInput(
      stateMachineInput as string,
      stateMachineValue,
    );
  }, [usesStateMachine, stateMachineInput, stateMachineValue]);

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
      <DotLottie
        ref={ref}
        source={source}
        useFrameInterpolation
        {...(usesStateMachine
          ? { stateMachineId }
          : { autoplay: true, loop: true })}
        style={{ width: size, height: size }}
        // Load/start the machine here rather than relying on the prop setter:
        // the prop can land before the native view has built its animation, in
        // which case the load is a silent no-op and is never retried.
        onLoad={() => {
          if (!usesStateMachine) return;
          ref.current?.stateMachineLoad(stateMachineId as string);
          ref.current?.stateMachineStart();
          ref.current?.stateMachineSetBooleanInput(
            stateMachineInput as string,
            stateMachineValue,
          );
        }}
      />
    </Animated.View>
  );
}
