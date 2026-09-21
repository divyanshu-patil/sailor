import React from "react";
import { Pressable, PressableProps, StyleProp, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { DAILY_SPRING } from "../theme";

interface PressableCardProps extends Omit<PressableProps, "style"> {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  /** Fired on the press itself, so a touch that slides off the card never
   *  claims to have been a tap. */
  onHaptic?: () => void;
  scaleTo?: number;
}

/**
 * A press target that dips under the finger.
 *
 * Spring rather than timing, and driven on press-in/press-out rather than on
 * the tap, so an interrupted press (finger slides off) springs back instead of
 * completing an animation for something that never happened.
 */
export function PressableCard({
  style,
  children,
  onHaptic,
  onPress,
  onPressIn,
  onPressOut,
  scaleTo = 0.97,
  ...rest
}: PressableCardProps) {
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * (1 - scaleTo) }],
    opacity: 1 - pressed.value * 0.06,
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        {...rest}
        onPress={(e) => {
          onHaptic?.();
          onPress?.(e);
        }}
        onPressIn={(e) => {
          pressed.value = withSpring(1, DAILY_SPRING);
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          pressed.value = withSpring(0, DAILY_SPRING);
          onPressOut?.(e);
        }}
        style={style}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
