import { StyleSheet, View } from "react-native";

import { PROFILE } from "@/screens/profile/theme";
import Animated, { LinearTransition } from "react-native-reanimated";

interface OnboardingProgressProps {
  /** 0–1, derived from the configured flow. */
  progress: number;
}

/** The only chrome on the first step: a track and an ink fill. */
export default function OnboardingProgress({
  progress,
}: OnboardingProgressProps) {
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityValue={{
        min: 0,
        max: 100,
        now: Math.round(clamped * 100),
      }}
    >
      <Animated.View layout={LinearTransition.springify()} style={[styles.fill, { width: `${clamped * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: PROFILE.track,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: PROFILE.ink,
  },
});
