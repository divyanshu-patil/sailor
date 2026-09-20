// [COMMENT LATER]
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import Icon from "@react-native-vector-icons/lucide";
import Animated, { FadeInDown } from "react-native-reanimated";

import { haptics } from "@/lib/haptics";
import { useDailyStore } from "@/store/daily-store";

import { dailyFonts, radius } from "../theme";

const PALETTE = {
  light: ["#FFE2E4", "#B23A3F"],
  dark: ["#3A1D1F", "#FF8A8F"],
};

/**
 * [COMMENT LATER]
 * "Your streak reset" — the counterpart to StreakAtRisk, for after it happened.
 *
 * Gated on `longestStreak > 0`, not just `currentStreak === 0`: someone who has
 * never practised has no streak to restore, and offering to restore one they
 * never had is the kind of thing that makes an app feel like it isn't reading
 * the same data the user is.
 */
export function StreakBroken() {
  const streak = useDailyStore((s) => s.streak);
  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  const [bg, ink] = PALETTE[isDark ? "dark" : "light"];

  if (!streak || streak.currentStreak > 0 || streak.longestStreak <= 0) {
    return null;
  }

  return (
    <Animated.View
      entering={FadeInDown.duration(420).springify().damping(70)}
      style={[styles.card, { backgroundColor: bg }]}
    >
      <Icon name="heart-crack" size={30} color={ink} />
      <View style={styles.text}>
        <Text style={[styles.kicker, { color: ink }]}>Your streak reset</Text>
        <Text style={[styles.body, { color: ink }]}>
          {streak.longestStreak} {streak.longestStreak === 1 ? "day" : "days"}{" "}
          was your best. Restore it, or start again today.
        </Text>
      </View>
      <Pressable
        onPress={() => {
          haptics.advance();
          router.push("/(authenticated)/streak-restore");
        }}
        accessibilityRole="button"
        accessibilityLabel="Restore your streak"
        hitSlop={8}
        style={[styles.button, { borderColor: ink }]}
      >
        <Text style={[styles.buttonLabel, { color: ink }]}>Restore</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: radius.card,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginTop: 18,
  },
  text: { flex: 1 },
  kicker: { fontFamily: dailyFonts.semibold, fontSize: 15 },
  body: { fontFamily: dailyFonts.medium, fontSize: 13.5, opacity: 0.85 },
  button: {
    borderWidth: 1.5,
    borderRadius: radius.pill,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  buttonLabel: { fontFamily: dailyFonts.semibold, fontSize: 14 },
});
