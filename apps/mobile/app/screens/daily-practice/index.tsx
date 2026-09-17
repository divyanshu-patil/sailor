import React, { useEffect } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { fonts } from "@/constants/fonts";
import { useDailyPractice } from "@/hooks/use-daily-practice";
import { CONTENT_TYPE_LABELS } from "@/types/daily";

/**
 * Daily practice — the ten-second screen.
 *
 * Deliberately not the swipe-card deck of ScriptPracticeScreen: this is one
 * paragraph the user reads aloud once. The whole design constraint is that
 * nothing here should need a decision. One paragraph, one tip, one button.
 */
const DailyPracticeScreen = () => {
  const { unit, isStale, streak, isLoading, isCompleting, error, markComplete } =
    useDailyPractice();

  const isDark = useColorScheme() === "dark";
  const palette = isDark ? darkPalette : lightPalette;

  // One entrance, not a sequence of them. The screen exists to be calm, so the
  // motion is a single 320ms settle — long enough to feel deliberate, short
  // enough that a user coming from a notification isn't waiting on it.
  const entrance = useSharedValue(0);
  useEffect(() => {
    if (unit) {
      entrance.value = withTiming(1, {
        duration: 320,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [entrance, unit]);

  const bodyStyle = useAnimatedStyle(() => ({
    opacity: entrance.value,
    transform: [{ translateY: (1 - entrance.value) * 12 }],
  }));

  const tipStyle = useAnimatedStyle(() => ({
    opacity: withDelay(80, withTiming(entrance.value, { duration: 320 })),
  }));

  if (!unit) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: palette.bg }]}>
        {isLoading ? (
          <ActivityIndicator color={palette.muted} />
        ) : (
          <Text style={[styles.tip, { color: palette.muted }]}>
            {error ?? "Today's practice isn't ready yet."}
          </Text>
        )}
      </View>
    );
  }

  const completed = streak?.completedToday ?? false;

  return (
    <ScrollView
      style={{ backgroundColor: palette.bg }}
      contentContainerStyle={styles.container}
      // Dynamic Type can push a three-sentence paragraph past the viewport at
      // the larger accessibility sizes, so this scrolls rather than truncates.
      alwaysBounceVertical={false}
    >
      <View style={styles.header}>
        <Text
          style={[styles.label, { color: palette.muted }]}
          accessibilityLabel={`Today's theme: ${CONTENT_TYPE_LABELS[unit.type]}`}
        >
          {CONTENT_TYPE_LABELS[unit.type]?.toUpperCase()}
        </Text>
        {streak != null && streak.currentStreak > 0 && (
          <Text
            style={[styles.streak, { color: palette.muted }]}
            accessibilityLabel={`${streak.currentStreak} day streak`}
          >
            {streak.currentStreak}&nbsp;day{streak.currentStreak === 1 ? "" : "s"}
          </Text>
        )}
      </View>

      <Animated.Text
        style={[styles.body, { color: palette.text }, bodyStyle]}
        accessibilityRole="text"
        accessibilityLabel={`Today's practice. ${unit.body}`}
      >
        {unit.body}
      </Animated.Text>

      <Animated.Text style={[styles.tip, { color: palette.muted }, tipStyle]}>
        {unit.tip}
      </Animated.Text>

      {isStale && (
        <Text style={[styles.notice, { color: palette.muted }]}>
          Showing your last saved practice — this will refresh when you&apos;re back online.
        </Text>
      )}

      <Pressable
        onPress={markComplete}
        disabled={completed || isCompleting}
        accessibilityRole="button"
        accessibilityState={{ disabled: completed, checked: completed }}
        accessibilityLabel={completed ? "Practised today" : "Mark as practised"}
        style={({ pressed }) => [
          styles.action,
          {
            backgroundColor: completed ? "transparent" : palette.text,
            borderColor: palette.text,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Text
          style={[
            styles.actionLabel,
            { color: completed ? palette.text : palette.bg },
          ]}
        >
          {completed ? "Practised ✓" : "Mark as practised"}
        </Text>
      </Pressable>
    </ScrollView>
  );
};

export default DailyPracticeScreen;

const lightPalette = { bg: "#FBFAF7", text: "#1B1B1B", muted: "#8A857C" };
const darkPalette = { bg: "#141413", text: "#F5F3EE", muted: "#8A857C" };

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 12, paddingBottom: 48 },
  centered: { alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  label: { fontFamily: fonts.alanSans.medium, fontSize: 12, letterSpacing: 1.2 },
  streak: { fontFamily: fonts.alanSans.medium, fontSize: 12 },
  // The paragraph is the screen. Serif at a reading size, generous leading —
  // this is text to say out loud, not a UI string.
  body: { fontFamily: fonts.newsreader.regular, fontSize: 26, lineHeight: 38 },
  tip: { fontFamily: fonts.alanSans.regular, fontSize: 15, lineHeight: 22, marginTop: 28 },
  notice: { fontFamily: fonts.alanSans.regular, fontSize: 13, marginTop: 20 },
  action: {
    marginTop: "auto",
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
  },
  actionLabel: { fontFamily: fonts.alanSans.medium, fontSize: 16 },
});
