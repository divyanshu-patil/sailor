import React from "react";
import Icon from "@react-native-vector-icons/lucide";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";

import { haptics } from "@/lib/haptics";
import { useDailyPractice } from "@/hooks/use-daily-practice";

import { exitToHome } from "./exit";
import { Mascot } from "./components/Mascot";
import { MetaRow } from "./components/MetaRow";
import { PressableCard } from "./components/PressableCard";
import {
  dailyFonts,
  dailyTheme,
  estimateMinutes,
  HEADER_INSET,
  radius,
  shadow,
  toLines,
} from "./theme";

/** A lucide glyph per step position, so the list reads as a sequence of
 *  different moves rather than a numbered wall. Cycles past the fifth. */
const STEP_ICONS = [
  "target",
  "message-square",
  "bar-chart",
  "layers",
  "flag",
] as const;

/**
 * Daily practice — the intro.
 *
 * Sets up what today is before any reading starts: which framework, how long it
 * will take, and the step order the snippet demonstrates. The back affordance is
 * the real native chevron from the stack header (see the route layout), not a
 * drawn button.
 */
const DailyPracticeIntro = () => {
  const router = useRouter();
  const { unit, streak, isLoading, error } = useDailyPractice();
  const theme = dailyTheme(useColorScheme() === "dark");
  const insets = useSafeAreaInsets();

  if (!unit) {
    return (
      <View
        style={[styles.screen, styles.centre, { backgroundColor: theme.bg }]}
      >
        {isLoading ? (
          <ActivityIndicator color={theme.inkFaint} />
        ) : (
          <Text style={[styles.emptyText, { color: theme.inkSoft }]}>
            {error ?? "Today's practice isn't ready yet."}
          </Text>
        )}
      </View>
    );
  }

  const lines = toLines(unit.body);
  const minutes = estimateMinutes(unit.body);
  const done = streak?.completedToday ?? false;

  // Defaulted, not trusted. The persisted cache holds whatever shape the build
  // that wrote it had, and `frameworkSteps` was added after units were already
  // being cached — so a user upgrading across that change had `undefined` here
  // and the screen crashed on `.map`. The store version bump clears those
  // entries, but any field added later lands in exactly the same trap, so the
  // read is defensive as well.
  const steps = unit.frameworkSteps ?? [];

  return (
    <>
      {/* Drawn rather than inherited: the native chevron only appears when this
          screen was pushed, and a widget cold-launch has no history at all.
          `exitToHome` pops to home when it is behind us and replaces with it
          when it isn't, so the chevron always means the same thing. */}
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button icon={"chevron.backward"} onPress={exitToHome} />
      </Stack.Toolbar>
      <ScrollView
        style={{ backgroundColor: theme.bg }}
        // The native header is transparent, so content would otherwise start
        // underneath the back chevron.
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + HEADER_INSET,
            paddingBottom: insets.bottom + 24,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          entering={FadeInDown.duration(380).springify().damping(70)}
        >
          <Text style={[styles.title, { color: theme.ink }]}>
            Daily Practice
          </Text>
          <Text style={[styles.subtitle, { color: theme.inkSoft }]}>
            A short snippet to read aloud, new every day.
          </Text>
        </Animated.View>

        {/* Today's topic */}
        <Animated.View
          entering={FadeInDown.delay(70).duration(420).springify().damping(70)}
          style={[styles.topicCard, shadow, { backgroundColor: theme.card }]}
        >
          <View style={styles.topicText}>
            <View style={styles.pillRow}>
              <View style={[styles.pill, { backgroundColor: theme.cardAlt }]}>
                <Text style={[styles.pillText, { color: theme.ink }]}>
                  Today&apos;s topic
                </Text>
              </View>

              {/* The framework is HOW today's snippet is built — a secondary fact
                that belongs beside the topic, not in place of it. */}
              {unit.frameworkLabel ? (
                <Pressable
                  onPress={() => {
                    haptics.advance();
                    router.push("/(authenticated)/daily-practice/framework");
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`About the ${unit.frameworkLabel} framework`}
                  accessibilityHint="Opens an explanation of this framework"
                  hitSlop={8}
                  style={[styles.frameworkPill, { borderColor: theme.accent }]}
                >
                  <Text
                    style={[styles.frameworkPillText, { color: theme.accent }]}
                  >
                    {unit.frameworkLabel}
                  </Text>
                  <Icon
                    name="info"
                    size={13}
                    color={theme.accent}
                    style={styles.infoGlyph}
                  />
                </Pressable>
              ) : null}
            </View>

            {/* The speech's own topic. This used to show the framework name,
              which answers "how is it structured" rather than "what is it
              about". */}
            <Text
              style={[styles.topicTitle, { color: theme.ink }]}
              numberOfLines={3}
            >
              {unit.title || unit.frameworkLabel || "Today's practice"}
            </Text>

            {/* Stacked, each with its own icon. */}
            <MetaRow
              icon="book-open"
              label={`${lines.length} ${lines.length === 1 ? "line" : "lines"}`}
              theme={theme}
            />
            <MetaRow icon="timer" label={`~${minutes} min`} theme={theme} />
          </View>

          {/* Anchored bottom-right and allowed to overflow the card's corner, the
            way the character sits in the reference art. */}
          <View style={styles.mascotWell} pointerEvents="none">
            <Mascot pose="reading" size={140} />
          </View>
        </Animated.View>

        {/* The framework's own step order — real structure, not invented copy. */}
        {steps.length > 0 && (
          <Animated.View
            entering={FadeInDown.delay(140)
              .duration(420)
              .springify()
              .damping(70)}
          >
            <Text style={[styles.sectionTitle, { color: theme.ink }]}>
              How it works
            </Text>
            {steps.map((step, index) => (
              <Animated.View
                key={`${step}-${index}`}
                entering={FadeInDown.delay(180 + index * 55)
                  .duration(380)
                  .springify()
                  .damping(70)}
                style={[
                  styles.stepRow,
                  shadow,
                  { backgroundColor: theme.cardAlt },
                ]}
              >
                <View
                  style={[
                    styles.stepIcon,
                    { backgroundColor: theme.accentSoft },
                  ]}
                >
                  <Icon
                    name={STEP_ICONS[index % STEP_ICONS.length]}
                    size={19}
                    color={theme.accent}
                  />
                </View>
                <Text style={[styles.stepLabel, { color: theme.ink }]}>
                  {step}
                </Text>
              </Animated.View>
            ))}
          </Animated.View>
        )}

        <View style={styles.spacer} />

        <Animated.View
          entering={FadeInDown.delay(260).duration(420).springify().damping(70)}
        >
          <PressableCard
            onHaptic={haptics.start}
            onPress={() =>
              router.push("/(authenticated)/daily-practice/practice")
            }
            accessibilityRole="button"
            accessibilityLabel={done ? "Practise again" : "Start practice"}
            style={[styles.cta, { backgroundColor: theme.button }]}
          >
            <Text style={[styles.ctaText, { color: theme.buttonInk }]}>
              {done ? "Practise again" : "Start Practice"}
            </Text>
            <Icon
              name="arrow-right"
              size={20}
              color={theme.buttonInk}
              style={styles.ctaArrow}
            />
          </PressableCard>

          {done && (
            <Text style={[styles.doneNote, { color: theme.inkSoft }]}>
              Already done today — your streak is safe.
            </Text>
          )}
        </Animated.View>
      </ScrollView>
    </>
  );
};

export default DailyPracticeIntro;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centre: { alignItems: "center", justifyContent: "center", padding: 32 },
  emptyText: { fontFamily: dailyFonts.body, fontSize: 15, textAlign: "center" },
  content: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 4 },

  title: { fontFamily: dailyFonts.display, fontSize: 34, letterSpacing: -0.6 },
  subtitle: {
    fontFamily: dailyFonts.body,
    fontSize: 15.5,
    marginTop: 6,
    lineHeight: 22,
  },

  topicCard: {
    flexDirection: "row",
    borderRadius: radius.card,
    padding: 22,
    marginTop: 22,
    // The card carries the screen — it was previously sized by its text and
    // collapsed to a strip once the framework label was one short word.
    minHeight: 230,
    overflow: "hidden",
  },
  topicText: { flex: 1, paddingRight: 4 },
  pillRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  pill: {
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  frameworkPill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.pill,
    borderWidth: 1.2,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  frameworkPillText: { fontFamily: dailyFonts.semibold, fontSize: 12.5 },
  infoGlyph: { marginLeft: 5 },
  pillText: { fontFamily: dailyFonts.medium, fontSize: 13 },
  topicTitle: {
    fontFamily: dailyFonts.display,
    fontSize: 30,
    marginTop: 16,
    lineHeight: 35,
    letterSpacing: -0.5,
  },
  mascotWell: {
    position: "absolute",
    right: -14,
    bottom: -16,
    alignItems: "flex-end",
    justifyContent: "flex-end",
  },

  sectionTitle: {
    fontFamily: dailyFonts.semibold,
    fontSize: 19,
    marginTop: 30,
    marginBottom: 14,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 16,
    paddingLeft: 8,
    marginBottom: 11,
  },
  stepIcon: {
    width: 48,
    aspectRatio: 1,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  stepLabel: {
    fontFamily: dailyFonts.semibold,
    fontSize: 16,
    marginLeft: 14,
    flex: 1,
    lineHeight: 22,
  },

  spacer: { flex: 1, minHeight: 26 },

  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.button,
    paddingVertical: 21,
    marginTop: 14,
  },
  ctaText: { fontFamily: dailyFonts.semibold, fontSize: 17.5 },
  ctaArrow: { marginLeft: 10 },
  doneNote: {
    fontFamily: dailyFonts.body,
    fontSize: 13.5,
    textAlign: "center",
    marginTop: 14,
  },
});
