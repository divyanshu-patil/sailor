import { GestureResponderEvent, PressableProps } from "react-native";
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
    ...props
  }: PressableScaleProps) => {
    const pressed = useSharedValue(0);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [
        {
          scale: withTiming(pressed.value ? pressedScale : 1, {
            duration,
          }),
        },
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
