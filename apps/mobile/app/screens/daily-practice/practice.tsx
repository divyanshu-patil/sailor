/* eslint-disable react-hooks/immutability -- `offset` is a shared value owned by
   this screen and written from worklets; the rule can't see that a SharedValue
   is meant to be mutated. Same convention as new-script/components/value-dial. */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Icon from "@react-native-vector-icons/lucide";
import { StyleSheet, Text, useColorScheme, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Presets } from "react-native-pulsar";

import { useDailyStore } from "@/store/daily-store";
import { haptics } from "@/lib/haptics";

import { PressableCard } from "./components/PressableCard";
import { TeleprompterLine } from "./components/TeleprompterLine";
import {
  DAILY_SPRING,
  dailyFonts,
  dailyTheme,
  estimateMinutes,
  HEADER_INSET,
  radius,
  toLines,
} from "./theme";
import { useHeaderHeight } from "expo-router/react-navigation";
import { scheduleOnRN } from "react-native-worklets";

/** Drag distance that advances exactly one line. */
const LINE_TRAVEL = 110;
/**
 * Slot pitch — the distance between two consecutive paragraphs.
 *
 * Has to clear the TALLEST paragraph, not the average one. At 112 a snippet
 * that wrapped to four lines was ~140pt tall and overlapped its neighbours, so
 * the greyed paragraphs above and below ran straight through the focused one.
 */
const LINE_HEIGHT = 250;

/**
 * The teleprompter.
 *
 * Driven by a vertical pan: as you drag, every line moves, resizes, fades and
 * shifts colour continuously, and the gesture settles onto the nearest line with
 * a tick. That continuous response is the point — a tap-to-advance screen tells
 * you nothing about where you are in the snippet while your eyes are on the
 * words.
 *
 * The whole interaction lives on the UI thread. `offset` is a shared value the
 * pan writes directly, each line reads it in its own worklet, and the only hop
 * back to JS is the committed line index (for the counter and the footer).
 */
const DailyPracticeSession = () => {
  const router = useRouter();
  const unit = useDailyStore((s) => s.unit);
  const theme = dailyTheme(useColorScheme() === "dark");
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const lines = unit ? toLines(unit.body) : [];
  const total = lines.length;

  // Set in an effect, not at render: this project builds with the React
  // Compiler, and `Date.now()` during render is an impure call whose value can
  // change on any re-render the compiler decides to make.
  const startedAt = useRef<number | null>(null);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  /** Fractional scroll position in line units. Owned by the gesture. */
  const offset = useSharedValue(0);

  /**
   * Measured height of each paragraph, so the highlight can be the size of the
   * text rather than a fixed box the text spills out of.
   *
   * Mirrored into a shared value because the band's height is computed in a
   * worklet on every frame of the drag — reading React state there would mean
   * hopping to JS per frame.
   */
  const [heights, setHeights] = useState<number[]>([]);
  const measuredHeights = useSharedValue<number[]>([]);

  const handleMeasure = useCallback((index: number, height: number) => {
    setHeights((current) => {
      if (Math.abs((current[index] ?? 0) - height) < 0.5) return current;
      const next = [...current];
      next[index] = height;
      return next;
    });
  }, []);

  useEffect(() => {
    measuredHeights.value = heights;
  }, [heights, measuredHeights]);
  const dragStart = useSharedValue(0);
  const [index, setIndex] = useState(0);

  const finish = useCallback(() => {
    haptics.finishLine();
    const seconds = startedAt.current
      ? Math.round((Date.now() - startedAt.current) / 1000)
      : 0;
    router.replace({
      pathname: "/(authenticated)/daily-practice/complete",
      params: { seconds: String(seconds), lines: String(total) },
    });
  }, [router, total]);

  // Crossing a line boundary mid-drag ticks, so the snap points are felt rather
  // than only seen. Pulsar presets are worklets, so this lands on the UI thread
  // with the crossing instead of a frame later via JS.
  const lastTicked = useSharedValue(0);
  useDerivedValue(() => {
    const nearest = Math.round(offset.value);
    if (nearest !== lastTicked.value && nearest >= 0 && nearest < total) {
      lastTicked.value = nearest;
      Presets.System.selection();
      scheduleOnRN(setIndex, nearest);
    }
  }, [total]);

  // Memoised so the detector isn't handed a brand-new gesture every render,
  // which would drop an in-flight drag.
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .onStart(() => {
          dragStart.value = offset.value;
        })
        .onUpdate((event) => {
          // Dragging up pulls later lines toward the centre, like a reel.
          const next = dragStart.value - event.translationY / LINE_TRAVEL;
          // Allowed half a line past each end rather than hard-stopping: a wall
          // at the last line feels broken, a little give reads as "that's the end".
          offset.value = Math.min(Math.max(next, -0.5), total - 0.5);
        })
        .onEnd((event) => {
          // Carry a little of the throw into the landing so a flick can move
          // more than one line.
          const projected = offset.value - event.velocityY / (LINE_TRAVEL * 14);
          const target = Math.min(
            Math.max(Math.round(projected), 0),
            total - 1,
          );
          offset.value = withSpring(target, DAILY_SPRING);
        }),
    [dragStart, offset, total],
  );

  /**
   * The highlight follows the text.
   *
   * Interpolated between the two paragraphs the drag currently sits between, so
   * the band grows and shrinks continuously as a short paragraph scrolls into a
   * long one instead of jumping at the snap point.
   */

  const progressStyle = useAnimatedStyle(() => ({
    width: `${total > 1 ? Math.min(100, ((offset.value + 1) / total) * 100) : 100}%`,
  }));

  if (!unit || total === 0) {
    return (
      <View
        style={[styles.screen, styles.centre, { backgroundColor: theme.bg }]}
      >
        <Text style={[styles.hint, { color: theme.inkSoft }]}>
          Nothing to practise yet.
        </Text>
      </View>
    );
  }

  const isLast = index >= total - 1;

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: theme.bg, paddingTop: headerHeight },
      ]}
    >
      {/* The line counter, as a real bar button item.
          `Stack.Toolbar.View` wrapped it in the system's glass capsule, which
          sat lower and larger than the back chevron opposite it. A plain button
          with the shared background hidden is a normal header item, so it
          aligns with the chevron the way any right-hand title does.
          `disabled` because it is an indicator, not a control — the tint is set
          explicitly so it doesn't render greyed out. */}
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button variant="prominent" tintColor={"#F78199"}>
          {`${index + 1} / ${total}`}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>

      <GestureDetector gesture={pan}>
        <View
          style={[styles.stage, { paddingTop: insets.top + HEADER_INSET }]}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={`Line ${index + 1} of ${total}. ${lines[index]}`}
          accessibilityHint="Swipe up or down to move between lines"
        >
          {/* A soft band marking the read position, so the centre is a place
              rather than an implied one. */}
          <View style={styles.column} pointerEvents="none">
            {lines.map((line, lineIndex) => (
              <TeleprompterLine
                key={lineIndex}
                text={line}
                index={lineIndex}
                offset={offset}
                lineHeight={LINE_HEIGHT}
                height={heights[lineIndex] ?? 0}
                onMeasure={handleMeasure}
                theme={theme}
              />
            ))}
          </View>
        </View>
      </GestureDetector>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 18 }]}>
        <View style={styles.progressRow}>
          <View style={[styles.track, { backgroundColor: theme.divider }]}>
            <Animated.View
              style={[
                styles.fill,
                progressStyle,
                { backgroundColor: theme.accent },
              ]}
            />
          </View>
          <Text style={[styles.remaining, { color: theme.inkSoft }]}>
            ~{estimateMinutes(unit.body)} min
          </Text>
        </View>

        <PressableCard
          onHaptic={haptics.advance}
          onPress={() => {
            if (isLast) {
              finish();
              return;
            }
            const next = Math.min(index + 1, total - 1);
            offset.value = withSpring(next, DAILY_SPRING);
          }}
          accessibilityRole="button"
          accessibilityLabel={isLast ? "Finish practice" : "Next line"}
          style={[styles.cta, { backgroundColor: theme.button }]}
        >
          <Text style={[styles.ctaText, { color: theme.buttonInk }]}>
            {isLast ? "Finish" : "Next line"}
          </Text>
          <Icon
            name={isLast ? "check" : "arrow-down"}
            size={19}
            color={theme.buttonInk}
            style={styles.ctaIcon}
          />
        </PressableCard>
      </View>
    </View>
  );
};

export default DailyPracticeSession;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centre: { alignItems: "center", justifyContent: "center" },
  hint: { fontFamily: dailyFonts.body, fontSize: 15 },

  counter: {
    fontFamily: dailyFonts.semibold,
    fontSize: 14,
    minWidth: 44,
    textAlign: "right",
  },

  stage: { flex: 1, justifyContent: "center", paddingHorizontal: 26 },
  focusBand: {
    position: "absolute",
    left: -14,
    right: -14,
    top: 0,
    borderRadius: radius.card,
    opacity: 0.55,
  },
  // A zero-height anchor at the vertical centre of the stage. Both the
  // paragraphs and the highlight hang off it and offset themselves by half
  // their own height, which is what keeps them concentric at any text length.
  column: { height: 0, justifyContent: "center" },

  footer: { paddingHorizontal: 22, paddingTop: 10 },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  track: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3 },
  remaining: { fontFamily: dailyFonts.medium, fontSize: 13 },

  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.button,
    paddingVertical: 20,
  },
  ctaText: { fontFamily: dailyFonts.semibold, fontSize: 17 },
  ctaIcon: { marginLeft: 9 },
});
