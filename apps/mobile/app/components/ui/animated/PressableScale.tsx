import { GestureResponderEvent, PressableProps, ViewStyle } from "react-native";
import React from "react";
import { AnimatedPressable } from "./AnimatedComponents";
import {
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

interface PressableScaleProps extends PressableProps {
  pressedScale?: number;
  duration?: number;
  opacity?: {
    pressedOpacity: number;
  };
  /** A static transform to keep while the press scale animates — a tilt, say.
   *  Typed without the string form, which cannot be merged into a list. */
  transformStyle?: Exclude<ViewStyle["transform"], string | undefined>;
}
const PressableScale = React.memo(
  ({
    children,
    pressedScale = 0.97,
    duration = 100,
    opacity,
    style,
    onPressIn,
    onPressOut,
    transformStyle,
    ...props
  }: PressableScaleProps) => {
    const pressed = useSharedValue(0);

    // `transformStyle` has to be merged into THIS list rather than passed as
    // its own style. It was being spread as `{ transformStyle }` — not a React
    // Native style property at all, so it was silently dropped — and putting it
    // in the array as `{ transform }` instead would have replaced the scale
    // below, because RN swaps the whole transform list rather than merging it.
    const animatedStyle = useAnimatedStyle(() => ({
      transform: [
        {
          scale: withTiming(pressed.value ? pressedScale : 1, {
            duration,
          }),
        },
        ...(transformStyle ?? []),
      ],
      opacity: opacity
        ? withTiming(pressed.value ? opacity.pressedOpacity : 1)
        : undefined,
    }));

    const handleOnPressIn = (e: GestureResponderEvent) => {
      pressed.value = 1;
      onPressIn?.(e);
    };
    const handleOnPressOut = (e: GestureResponderEvent) => {
      pressed.value = 0;
      onPressOut?.(e);
    };
    return (
      <AnimatedPressable
        {...props}
        onPressIn={handleOnPressIn}
        onPressOut={handleOnPressOut}
        layout={LinearTransition.springify()}
        style={[style, animatedStyle]}
      >
        {children}
      </AnimatedPressable>
    );
  },
);

PressableScale.displayName = "PressableScale";

export default PressableScale;
