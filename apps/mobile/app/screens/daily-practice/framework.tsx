import React from "react";
import Icon from "@react-native-vector-icons/lucide";
import {
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { haptics } from "@/lib/haptics";
import { useDailyStore } from "@/store/daily-store";

import { BackdropShapes } from "./components/BackdropShapes";
import { Mascot } from "./components/Mascot";
import { PressableCard } from "./components/PressableCard";
import { dailyFonts, dailyTheme, radius } from "./theme";

/**
 * The icon name arrives from the API as a plain string, while the component's
 * `name` prop is a union of every lucide glyph. Narrowed here, at the one
 * boundary it crosses, rather than by widening the component's own typing —
 * and defaulted, so a framework added server-side with a glyph this build of
 * the icon set doesn't have renders a book instead of crashing.
 */
type LucideName = React.ComponentProps<typeof Icon>["name"];

const FALLBACK_ICON: LucideName = "book-open";

function iconName(name: string | undefined): LucideName {
  return (name ?? FALLBACK_ICON) as LucideName;
}

/** One colour per step position, cycled. The reference walks pink → yellow →
 *  blue → violet down the list, which makes a long list scannable. */
const STEP_COLORS = [
  { bg: "#FBDDE3", ink: "#D8517A" },
  { bg: "#FBEFC9", ink: "#B6841A" },
  { bg: "#DCE4FB", ink: "#4F6BD0" },
  { bg: "#E8DFFB", ink: "#7A5BD0" },
  { bg: "#D9F0E4", ink: "#3E8A62" },
];

/**
 * The framework explainer.
 *
 * A real iOS modal route (`presentation: "modal"` in the layout), not a sheet
 * component mounted inside the intro screen. That gives the system card
 * transition, the drag-to-dismiss and the dimmed parent for free — the earlier
 * version reimplemented a scrim and a grabber by hand and got a flat panel with
 * none of it.
 *
 * Everything shown is already on the cached unit, so opening this costs no
 * request and works offline.
 */
const FrameworkExplainer = () => {
  const router = useRouter();
  const unit = useDailyStore((s) => s.unit);
  const theme = dailyTheme(useColorScheme() === "dark");
  const insets = useSafeAreaInsets();

  const steps = unit?.frameworkSteps ?? [];
  const hints = unit?.frameworkStepHints ?? [];
  const bestFor = unit?.frameworkBestFor ?? [];

  const close = () => {
    haptics.advance();
    router.back();
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <BackdropShapes theme={theme} />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Animated.View entering={FadeIn.duration(320)}>
            <View
              style={[styles.iconTile, { backgroundColor: theme.accentSoft }]}
            >
              <Icon
                name={iconName(unit?.frameworkIcon)}
                size={30}
                color={theme.accent}
              />
            </View>
          </Animated.View>
        </View>

        <Animated.View
          entering={FadeInDown.delay(60).duration(360).springify().damping(70)}
        >
          <Text style={[styles.title, { color: theme.ink }]}>
            {unit?.frameworkLabel ?? "This framework"}
          </Text>
          {steps.length > 0 && (
            <Text style={[styles.stepSummary, { color: theme.inkSoft }]}>
              {steps.join("  ·  ")}
            </Text>
          )}
          <Text style={[styles.description, { color: theme.inkSoft }]}>
            {unit?.frameworkDescription ?? ""}
          </Text>
        </Animated.View>

        {/* The steps, as a walkable list with a spine connecting them. */}
        <View style={styles.steps}>
          {steps.map((step, index) => {
            const colour = STEP_COLORS[index % STEP_COLORS.length];
            const isLast = index === steps.length - 1;
            return (
              <Animated.View
                key={`${step}-${index}`}
                entering={FadeInDown.delay(120 + index * 60)
                  .duration(340)
                  .springify()
                  .damping(70)}
                style={styles.stepRow}
              >
                <View style={styles.stepRail}>
                  <View
                    style={[styles.stepDot, { backgroundColor: colour.bg }]}
                  >
                    <Text style={[styles.stepNumber, { color: colour.ink }]}>
                      {index + 1}
                    </Text>
                  </View>
                  {/* The spine stops at the last dot rather than dangling. */}
                  {!isLast && (
                    <View
                      style={[
                        styles.stepLine,
                        { backgroundColor: theme.divider },
                      ]}
                    />
                  )}
                </View>

                <View style={styles.stepText}>
                  <Text style={[styles.stepName, { color: theme.ink }]}>
                    {step}
                  </Text>
                  {hints[index] ? (
                    <Text style={[styles.stepHint, { color: theme.inkSoft }]}>
                      {hints[index]}
                    </Text>
                  ) : null}
                </View>
              </Animated.View>
            );
          })}
        </View>

        {bestFor.length > 0 && (
          <Animated.View
            entering={FadeInDown.delay(260)
              .duration(360)
              .springify()
              .damping(70)}
          >
            <View
              style={[styles.divider, { backgroundColor: theme.divider }]}
            />
            <Text style={[styles.bestForLabel, { color: theme.inkSoft }]}>
              Best for
            </Text>
            <View style={styles.pillWrap}>
              {bestFor.map((label, index) => {
                const colour = STEP_COLORS[index % STEP_COLORS.length];
                return (
                  <View
                    key={label}
                    style={[styles.bestPill, { backgroundColor: colour.bg }]}
                  >
                    <Text style={[styles.bestPillText, { color: colour.ink }]}>
                      {label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Animated.View>
        )}

        {/* The character, tucked at the end so the explainer finishes warm
            rather than on a wall of text. */}
        <Animated.View
          entering={FadeIn.delay(360).duration(420)}
          style={styles.mascotRow}
        >
          <Mascot pose="reading" size={92} />
        </Animated.View>
      </ScrollView>

      {/* Pinned, so "Got it" is reachable without scrolling a long framework. */}
      <View
        style={[
          styles.footer,
          { paddingBottom: insets.bottom + 16, backgroundColor: theme.bg },
        ]}
      >
        <PressableCard
          onHaptic={haptics.start}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Got it"
          style={[styles.cta, { backgroundColor: theme.button }]}
        >
          <Text style={[styles.ctaText, { color: theme.buttonInk }]}>
            Got it
          </Text>
        </PressableCard>
      </View>
    </View>
  );
};

export default FrameworkExplainer;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 22 },

  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  iconTile: {
    width: 62,
    height: 62,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  title: {
    fontFamily: dailyFonts.display,
    fontSize: 36,
    marginTop: 20,
    letterSpacing: -0.8,
  },
  stepSummary: { fontFamily: dailyFonts.medium, fontSize: 15.5, marginTop: 6 },
  description: {
    fontFamily: dailyFonts.body,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 18,
  },

  steps: { marginTop: 26 },
  stepRow: { flexDirection: "row" },
  stepRail: { width: 38, alignItems: "center" },
  stepDot: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumber: { fontFamily: dailyFonts.semibold, fontSize: 15 },
  stepLine: { width: 1.5, flex: 1, marginVertical: 4, borderRadius: 1 },
  stepText: { flex: 1, paddingLeft: 14, paddingBottom: 22 },
  stepName: { fontFamily: dailyFonts.semibold, fontSize: 17.5 },
  stepHint: {
    fontFamily: dailyFonts.body,
    fontSize: 14.5,
    lineHeight: 20,
    marginTop: 3,
  },

  divider: { height: StyleSheet.hairlineWidth, marginTop: 4, marginBottom: 20 },
  bestForLabel: { fontFamily: dailyFonts.medium, fontSize: 14 },
  pillWrap: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 12 },
  bestPill: {
    borderRadius: radius.pill,
    paddingHorizontal: 15,
    paddingVertical: 9,
  },
  bestPillText: { fontFamily: dailyFonts.semibold, fontSize: 14 },

  mascotRow: { alignItems: "center", marginTop: 26 },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  cta: {
    alignItems: "center",
    borderRadius: radius.button,
    paddingVertical: 20,
  },
  ctaText: { fontFamily: dailyFonts.semibold, fontSize: 17.5 },
});
