import { memo, useEffect } from "react";
import { StyleProp, StyleSheet, Text, ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { PROFILE, profileFonts } from "../theme";

interface FloatingNoteProps {
  text: string;
  style?: StyleProp<ViewStyle>;
  /** Stagger so the two notes don't bob in lockstep. */
  delay?: number;
  /** Vertical travel in points. Kept tiny — this is an accent, not a bounce. */
  drift?: number;
}

/**
 * A short handwritten aside that breathes very slightly in place. Decorative
 * only, so it never captures touches and is hidden from screen readers.
 */
const FloatingNote = memo(function FloatingNote({
  text,
  style,
  delay = 0,
  drift = 5,
}: FloatingNoteProps) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: 3400, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
  }, [delay, t]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: (t.value - 0.5) * drift },
      { rotate: `${(t.value - 0.5) * 3}deg` },
    ],
  }));

  return (
    <Animated.View
      accessible={false}
      pointerEvents="none"
      style={[styles.wrap, style, animatedStyle]}
    >
      <Text style={styles.note}>{text}</Text>
    </Animated.View>
  );
});

export default FloatingNote;

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
  },
  note: {
    color: PROFILE.muted,
    fontFamily: profileFonts.handwritten,
    fontSize: 15,
    lineHeight: 18,
    letterSpacing: 0.2,
  },
});
