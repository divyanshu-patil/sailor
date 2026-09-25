import { memo, type ReactNode, useEffect } from "react";
import { StyleSheet, type ViewStyle } from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import Ionicons from "@react-native-vector-icons/ionicons";
import { colord } from "colord";

import { PROFILE } from "@/screens/profile/theme";

/**
 * The check in a chosen card's corner. Springs in with a little overshoot and
 * shrinks away when unchosen, so a selection reads as a response to the tap
 * rather than a border quietly changing colour.
 */
export const SelectionMark = memo(function SelectionMark({
  active,
  color = PROFILE.ink,
  style: placement,
}: {
  active: boolean;
  color?: string;
  /** Where it sits, when the card's top-right corner isn't square enough to
   *  hold it — see `pillMark`. */
  style?: ViewStyle;
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
      style={[styles.mark, { backgroundColor: color }, placement, style]}
    >
      <Ionicons name="checkmark" size={15} color={PROFILE.white} />
    </Animated.View>
  );
});

/** A list item that rises in after the ones above it. */
export function Stagger({
  index,
  base = 60,
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
      // Capped, so an eight-card list is settled as fast as a four-card one.
      entering={FadeInDown.delay(base + Math.min(index, 5) * 35)
        .duration(320)
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

/** A selected option's border: its own card colour, deepened enough to read
 *  against the card — not the mascot's, which is often another hue. */
export const selectedBorder = (card: string) => colord(card).darken(0.2).toHex();

/**
 * The mark's place on a pill-shaped card of this height: on the straight top
 * edge, just short of where the rounded end begins — the corner it sits in on
 * a square card is curved away on a pill.
 */
export const pillMark = (height: number): ViewStyle => ({
  top: 8,
  right: height / 2 - 10,
});

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
