import { memo, type ReactNode, useEffect } from "react";
import { StyleSheet, type ViewStyle } from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import Ionicons from "@react-native-vector-icons/ionicons";

import { PROFILE } from "@/screens/profile/theme";

/**
 * The check in a chosen card's corner. Springs in with a little overshoot and
 * shrinks away when unchosen, so a selection reads as a response to the tap
 * rather than a border quietly changing colour.
 */
export const SelectionMark = memo(function SelectionMark({
  active,
  color = PROFILE.ink,
}: {
  active: boolean;
  color?: string;
}) {
  const progress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(active ? 1 : 0, {
      damping: 70,
    });
  }, [active, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, progress.value * 1.4),
    transform: [
      { scale: 0.35 + 0.65 * progress.value },
      { rotate: `${(1 - progress.value) * -40}deg` },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.mark, { backgroundColor: color }, style]}
    >
      <Ionicons name="checkmark" size={15} color={PROFILE.white} />
    </Animated.View>
  );
});

/** A list item that rises in after the ones above it. */
export function Stagger({
  index,
  base = 80,
  children,
  style,
}: {
  index: number;
  base?: number;
  children: ReactNode;
  style?: ViewStyle;
}) {
  return (
    <Animated.View
      entering={FadeInDown.delay(base + index * 45)
        .duration(380)
        .withInitialValues({ transform: [{ translateY: 14 }] })}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

/** The step's heading block, landing first. */
export function HeadingIn({ children }: { children: ReactNode }) {
  return (
    <Animated.View entering={FadeInDown.duration(420)}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  mark: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
});
