import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, useColorScheme, View } from "react-native";
import Icon from "@react-native-vector-icons/lucide";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { haptics } from "@/lib/haptics";
import { streakDeadline } from "@/lib/streak-alarm";
import { useDailyStore } from "@/store/daily-store";

import { dailyFonts, radius } from "../theme";

const HOUR = 60 * 60 * 1000;

/** The cached streak's deadline, recomputed each tick so the banner goes away
 *  on its own at midnight rather than counting into negative time. */
export function useStreakCountdown(tickMs = 1000) {
  const streak = useDailyStore((s) => s.streak);
  const pending = useDailyStore((s) => s.pendingCompleteDate);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), tickMs);
    return () => clearInterval(id);
  }, [tickMs]);

  const target = useMemo(
    () => streakDeadline(streak, pending, now),
    [streak, pending, now],
  );
  return {
    target,
    remaining: target ? target.deadline.getTime() - now.getTime() : 0,
  };
}

export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${h}:${pad(m)}:${pad(s)}`;
}

/** Calm all day, loud at the end. */
function urgencyOf(remaining: number) {
  if (remaining <= HOUR) return "critical" as const;
  if (remaining <= 4 * HOUR) return "high" as const;
  return "low" as const;
}

const PALETTE = {
  low: { light: ["#FFF1D6", "#B26A00"], dark: ["#33270F", "#F5B547"] },
  high: { light: ["#FFE2CF", "#C2410C"], dark: ["#3A2213", "#FB8A4C"] },
  critical: { light: ["#FFD9DB", "#C8102E"], dark: ["#3D1519", "#FF6B72"] },
};

const COPY = {
  low: "Practise today to keep it alive.",
  high: "Hours left. Don't let it slip.",
  critical: "It resets to zero at midnight!",
};

/**
 * "Your streak ends in 3:12:45" — shown only when today is the last day to
 * save a streak. The flame beats faster as the clock runs down.
 */
export function StreakAtRisk() {
  const { target, remaining } = useStreakCountdown();
  const isDark = useColorScheme() === "dark";
  const level = urgencyOf(remaining);
  const [bg, ink] = PALETTE[level][isDark ? "dark" : "light"];
  const visible = !!target?.atRisk;

  const beat = useSharedValue(0);
  useEffect(() => {
    if (!visible) return;
    const half = level === "critical" ? 260 : level === "high" ? 480 : 900;
    beat.value = withRepeat(
      withSequence(
        withTiming(1, { duration: half, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: half, easing: Easing.in(Easing.quad) }),
      ),
      -1,
    );
  }, [beat, level, visible]);

  // One nudge per escalation, not per render.
  useEffect(() => {
    if (visible && level !== "low") haptics.warn();
  }, [level, visible]);

  const flame = useAnimatedStyle(() => ({
    transform: [
      { scale: 1 + beat.value * 0.18 },
      { rotate: `${(beat.value - 0.5) * 10}deg` },
    ],
  }));

  if (!visible || !target) return null;

  return (
    <Animated.View
      entering={FadeInDown.duration(420).springify().damping(70)}
      style={[styles.card, { backgroundColor: bg }]}
      accessible
      accessibilityRole="alert"
      accessibilityLabel={`Your ${target.count} day streak ends in ${formatRemaining(
        remaining,
      )}. ${COPY[level]}`}
    >
      <Animated.View style={flame}>
        <Icon name="flame" size={34} color={ink} />
      </Animated.View>
      <View style={styles.text}>
        <Text style={[styles.kicker, { color: ink }]}>
          {target.count}-day streak ends in
        </Text>
        <Text style={[styles.clock, { color: ink }]}>
          {formatRemaining(remaining)}
        </Text>
        <Text style={[styles.body, { color: ink }]}>{COPY[level]}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    borderRadius: radius.card,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginTop: 18,
  },
  text: { flex: 1 },
  kicker: { fontFamily: dailyFonts.semibold, fontSize: 14 },
  clock: {
    fontFamily: dailyFonts.display,
    fontSize: 30,
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"],
  },
  body: { fontFamily: dailyFonts.medium, fontSize: 13.5, opacity: 0.85 },
});
