import React, { useEffect, useRef } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { haptics } from "@/lib/haptics";
import { useDailyPractice } from "@/hooks/use-daily-practice";

import { Confetti } from "./components/Confetti";
import { exitToHome } from "./exit";
import { PressableCard } from "./components/PressableCard";
import { StatTile } from "./components/StatTile";
import { dailyFonts, dailyTheme, HEADER_INSET, radius, shadow } from "./theme";
import { fonts } from "@/constants/fonts";
import SkiaMascot from "@/components/ui/skia-mascot";
import { CELEBRATION_MASCOT } from "@/constants/mascots";

function formatDuration(totalSeconds: number): string {
  const safe =
    Number.isFinite(totalSeconds) && totalSeconds > 0 ? totalSeconds : 0;
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * The payoff.
 *
 * Completion is committed here rather than on the practice screen, so backing
 * out mid-snippet never counts as a practice. Every number shown is one the app
 * actually has — elapsed time, lines read, the streak the server returned. The
 * reference design has a third "Clarity %" tile; there is no clarity
 * measurement anywhere in this feature, and inventing a score would be the one
 * thing on this screen the user couldn't trust.
 */
const DailyPracticeComplete = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ seconds?: string; lines?: string }>();
  const { unit, streak, markComplete, isCompleting } = useDailyPractice();
  const theme = dailyTheme(useColorScheme() === "dark");
  const insets = useSafeAreaInsets();

  const committed = useRef(false);

  useEffect(() => {
    // Once per mount. Re-running would be harmless server-side (completion is
    // idempotent for the day) but would fire the celebration haptic twice.
    if (committed.current) return;
    committed.current = true;

    void (async () => {
      await markComplete();
      haptics.celebrate();
    })();
  }, [markComplete]);

  const seconds = Number(params.seconds ?? 0);
  const lines = Number(params.lines ?? 0);
  const streakCount = streak?.currentStreak ?? 0;
  const queuedOffline = streak?.completedToday === false && !isCompleting;

  return (
    <ScrollView
      style={{ backgroundColor: theme.bg }}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + HEADER_INSET,
          paddingBottom: insets.bottom + 22,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Completion is a one-way door — the cross leaves the flow entirely
          rather than stepping back into a snippet already marked done. It is a
          real toolbar item so it sits on the native header line instead of
          floating below it, which is where the drawn button ended up. */}
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          icon="xmark"
          tintColor={theme.ink}
          onPress={exitToHome}
        />
      </Stack.Toolbar>

      <View style={styles.hero}>
        {/* [LOTTIE-REPLACE] — see components/Confetti.tsx */}
        <Confetti width={340} height={250} />
        {/* A looping cheer. The canvas is wider
            than the hero on purpose: the character is ~45% of it. */}
        <Animated.View
          entering={FadeIn.duration(420).springify()}
          pointerEvents="none"
        >
          <SkiaMascot source={CELEBRATION_MASCOT.source} loop width={300} />
        </Animated.View>

        {/* The one bit of voice on the screen. Rotated and set in serif italic
            so it reads as written by hand, next to the character. */}
        <Animated.Text
          entering={FadeIn.delay(380).duration(420)}
          style={[styles.cheer, { color: theme.inkSoft }]}
        >
          Great job!
        </Animated.Text>
      </View>

      <Animated.View
        entering={FadeInDown.delay(160).duration(420).springify().damping(70)}
      >
        <Text style={[styles.title, { color: theme.ink }]}>
          Practice Complete!
        </Text>
        <Text style={[styles.subtitle, { color: theme.inkSoft }]}>
          You showed up. That&apos;s what matters.
        </Text>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(230).duration(420).springify().damping(70)}
        style={[styles.stats, shadow, { backgroundColor: theme.cardAlt }]}
      >
        <StatTile
          icon="timer"
          value={formatDuration(seconds)}
          label="Time spent"
          theme={theme}
        />
        <View
          style={[styles.statDivider, { backgroundColor: theme.divider }]}
        />
        <StatTile
          icon="file-text"
          value={`${lines}`}
          label={lines === 1 ? "Line read" : "Lines read"}
          theme={theme}
        />
        <View
          style={[styles.statDivider, { backgroundColor: theme.divider }]}
        />
        <StatTile
          icon="flame"
          value={`${streakCount}`}
          label="Day streak"
          theme={theme}
        />
      </Animated.View>

      {/* Today's tip, as the closing pull-quote — the one line worth carrying
          out of the session. */}
      <Animated.View
        entering={FadeInDown.delay(300).duration(420).springify().damping(70)}
        style={[styles.quote, { backgroundColor: theme.accentSoft }]}
      >
        <Text
          style={[
            styles.quoteMark,
            styles.quoteMarkOpen,
            { color: theme.accent },
          ]}
        >
          &ldquo;
        </Text>
        <Text style={[styles.quoteText, { color: theme.ink }]}>
          {queuedOffline
            ? "Saved offline — your streak syncs when you're back online."
            : (unit?.tip ?? "Small steps every day lead to big progress.")}
        </Text>
        <Text
          style={[
            styles.quoteMark,
            styles.quoteMarkClose,
            { color: theme.accent },
          ]}
        >
          &rdquo;
        </Text>
      </Animated.View>

      <View style={styles.spacer} />

      <Animated.View
        entering={FadeInDown.delay(360).duration(420).springify().damping(70)}
      >
        <PressableCard
          // No `onHaptic` — `exitToHome` plays its own, and two would fire.
          onPress={exitToHome}
          accessibilityRole="button"
          accessibilityLabel="Done"
          style={[styles.primary, { backgroundColor: theme.button }]}
        >
          <Text style={[styles.primaryText, { color: theme.buttonInk }]}>
            Done
          </Text>
        </PressableCard>

        <PressableCard
          onHaptic={haptics.advance}
          onPress={() =>
            router.replace("/(authenticated)/daily-practice/practice")
          }
          accessibilityRole="button"
          accessibilityLabel="Practise this again"
          style={[styles.secondary, { backgroundColor: theme.buttonSoft }]}
        >
          <Text style={[styles.secondaryText, { color: theme.ink }]}>
            Practise again
          </Text>
        </PressableCard>
      </Animated.View>
    </ScrollView>
  );
};

export default DailyPracticeComplete;

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: 22 },

  hero: {
    height: 250,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -8,
  },
  cheer: {
    position: "absolute",
    right: 6,
    top: 44,
    fontFamily: dailyFonts.serifItalic,
    fontSize: 21,
    transform: [{ rotate: "-9deg" }],
  },

  title: {
    fontFamily: dailyFonts.display,
    fontSize: 31,
    textAlign: "center",
    letterSpacing: -0.6,
  },
  subtitle: {
    fontFamily: dailyFonts.body,
    fontSize: 15.5,
    textAlign: "center",
    marginTop: 8,
  },

  stats: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.card,
    paddingVertical: 22,
    paddingHorizontal: 8,
    marginTop: 26,
  },
  statDivider: { width: StyleSheet.hairlineWidth, height: 54 },

  quote: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: radius.card,
    paddingVertical: 22,
    paddingHorizontal: 18,
    marginTop: 16,
  },
  // Oversized typographic marks, the way the reference frames the line.
  quoteMark: {
    fontFamily: dailyFonts.serifMedium,
    fontSize: 52,
    lineHeight: 52,
  },
  quoteMarkOpen: { marginTop: -6 },
  quoteMarkClose: { alignSelf: "flex-end", marginBottom: -22 },
  quoteText: {
    flex: 1,
    fontFamily: fonts.kalam.regular,
    fontSize: 18,
    lineHeight: 27,
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 4,
  },

  spacer: { flex: 1, minHeight: 26 },

  primary: {
    alignItems: "center",
    borderRadius: radius.button,
    paddingVertical: 21,
  },
  primaryText: { fontFamily: dailyFonts.semibold, fontSize: 17.5 },
  secondary: {
    alignItems: "center",
    borderRadius: radius.button,
    paddingVertical: 19,
    marginTop: 12,
  },
  secondaryText: { fontFamily: dailyFonts.semibold, fontSize: 16.5 },
});
