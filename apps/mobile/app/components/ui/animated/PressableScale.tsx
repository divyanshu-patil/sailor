import { GestureResponderEvent, PressableProps, ViewStyle } from "react-native";
import React from "react";
import { AnimatedPressable } from "./AnimatedComponents";
import { weight } from "@/lib/haptics";
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
  /**
   * What the press feels like. Defaults to the lightest tap in the vocabulary,
   * which is right for nearly everything this wraps.
   *
   * Pass a heavier one for a press that commits to something (buying, logging
   * out, deleting), or `null` for a control that already has its own feedback —
   * a row whose *destination* plays something on arrival, say, where both
   * would read as a double tap.
   */
  haptic?: (() => void) | null;
}
const PressableScale = React.memo(
  ({
    children,
    pressedScale = 0.97,
    duration = 100,
    opacity,
    style,
    onPress,
    onPressIn,
    onPressOut,
    transformStyle,
    haptic = weight.tap,
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
    const handleOnPress = (e: GestureResponderEvent) => {
      // On the press itself, not on press-in: a touch that slides off the
      // control never becomes a tap, and firing on the way down would have
      // already told the user it did. `onPress` only runs on a real release
      // inside the target, and Pressable does not call it when disabled.
      haptic?.();
      onPress?.(e);
    };
    const handleOnPressOut = (e: GestureResponderEvent) => {
      pressed.value = 0;
      onPressOut?.(e);
    };
    return (
      <AnimatedPressable
        {...props}
        onPress={handleOnPress}
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
