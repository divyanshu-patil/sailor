/* eslint-disable react-hooks/immutability -- the values written below are
   Reanimated shared values driven from gesture and scroll callbacks; the rule
   cannot see that a SharedValue is meant to be mutated. */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  scrollTo,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useFrameCallback,
  useSharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { colord } from "colord";

import { fonts } from "@/constants/fonts";
import { useColors } from "@/constants/theme";
import { useDeck } from "@/hooks";
import { TELEPROMPTER as T, speedLabel } from "./config";
import { toPromptLines } from "./lines";
import PromptLineView from "./prompt-line";
import StartButton from "./start-button";

/** Page colour when the route arrives without a deck colour. */
const FALLBACK_TINT = "#EFE7DA";

type TeleprompterParams = {
  /** The deck id, under the same param name the script screen uses. */
  script: string;
  color: string;
};

/**
 * The teleprompter.
 *
 * The whole screen is one number: `offset`, the scroll position. The frame
 * loop advances it, the user's own drags overwrite it, and every line dims by
 * its distance from it — all on the UI thread, so nothing here re-renders
 * while the text is moving. React only hears about starting, pausing and the
 * speed, which is three state changes for a whole read-through.
 *
 * Holding a finger down pauses it. That is the gesture a presenter reaches for
 * without being taught: it is "wait", and letting go is "carry on" — the
 * scroll resumes from where it stopped rather than catching up, because a
 * teleprompter that sprints to make up lost time is unreadable.
 */
const TeleprompterScreen = () => {
  const { script: deckId, color } = useLocalSearchParams<TeleprompterParams>();
  const { script, isLoading } = useDeck({ deckId });
  const { colors } = useColors();
  const insets = useSafeAreaInsets();

  const lines = useMemo(() => toPromptLines(script ?? ""), [script]);

  // A deck always has a colour; a deep link into this route may not carry one,
  // and `colord` answers an invalid input with black — which on a prompter is
  // dark ink on a near-black page, i.e. unreadable at the one moment someone
  // is standing in front of an audience.
  const deckColor = colord(color ?? "").isValid() ? color : FALLBACK_TINT;
  const screenColor = colord(deckColor).lighten(0.18).toHex();
  // The same colour at zero alpha — a transparent *white* fade would wash the
  // page out at both edges instead of dissolving into it.
  const fadedScreenColor = colord(screenColor).alpha(0).toHex();
  const inkColor = colord(deckColor).darken(0.62).desaturate(0.4).toHex();

  const scrollRef = useAnimatedRef<Animated.ScrollView>();

  /** Where the prompt is, in content points. The single source of truth. */
  const offset = useSharedValue(0);
  /** Furthest the prompt can go: the content that does not fit on screen. */
  const maxOffset = useSharedValue(0);
  /** Viewport height, and the line being read within it. */
  const viewport = useSharedValue(0);
  const contentHeight = useSharedValue(0);
  const focusY = useSharedValue(0);

  const running = useSharedValue(false);
  const holding = useSharedValue(false);
  const dragging = useSharedValue(false);
  const speed = useSharedValue<number>(T.defaultSpeed);

  // React's copies. They drive the button and the toolbar only — never the
  // loop, which reads the shared values above.
  const [started, setStarted] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState<number>(T.defaultSpeed);
  const [viewportHeight, setViewportHeight] = useState(0);

  const stop = useCallback(() => setIsRunning(false), []);

  const loop = useFrameCallback((frame) => {
    "worklet";
    if (!running.value || holding.value || dragging.value) return;
    if (maxOffset.value <= 0) return;
    if (offset.value >= maxOffset.value) return;

    // Clamped: a dropped frame (or coming back from the background) must not
    // teleport the prompt forward by however long the app was away.
    const dt = Math.min(frame.timeSincePreviousFrame ?? 16, 64) / 1000;
    const next = Math.min(
      offset.value + T.basePixelsPerSecond * speed.value * dt,
      maxOffset.value,
    );
    offset.value = next;
    scrollTo(scrollRef, 0, next, false);

    if (next >= maxOffset.value) {
      // End of the script: stop the clock rather than leave it running on a
      // prompt that has nothing left to show.
      running.value = false;
      scheduleOnRN(stop);
    }
  });

  // Only while it is actually prompting. A frame callback left running is a
  // worklet per frame for a screen that may never be started.
  useEffect(() => {
    loop.setActive(isRunning);
  }, [isRunning, loop]);

  /**
   * Manual scrolling.
   *
   * The drag wins while it lasts and the loop picks up from wherever it ends,
   * which is what makes scrolling back to re-read a line work: the prompt
   * carries on from that line, not from where it would have been.
   */
  const onScroll = useAnimatedScrollHandler({
    onBeginDrag: () => {
      dragging.value = true;
    },
    onScroll: (event) => {
      if (dragging.value) offset.value = event.contentOffset.y;
    },
    onEndDrag: (event) => {
      dragging.value = false;
      offset.value = event.contentOffset.y;
    },
    // A flick released with velocity keeps gliding; while the prompt is
    // stopped that glide is the user's, so the loop must not resume from
    // where their finger left the glass.
    onMomentumEnd: (event) => {
      offset.value = event.contentOffset.y;
    },
  });

  const onViewportLayout = (event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    viewport.value = height;
    focusY.value = height * T.focusRatio;
    maxOffset.value = Math.max(0, contentHeight.value - height);
    setViewportHeight(height);
  };

  const onContentSizeChange = (_: number, height: number) => {
    contentHeight.value = height;
    maxOffset.value = Math.max(0, height - viewport.value);
  };

  const toggle = useCallback(() => {
    // Flipped off the shared value, not inside a state updater: React may call
    // an updater twice, and doing the side effect in there would toggle the
    // scroll loop back on the second call while the button showed the first.
    const next = !running.value;
    running.value = next;
    setStarted(true);
    setIsRunning(next);
  }, [running]);

  const pickSpeed = useCallback(
    (value: number) => {
      speed.value = value;
      setCurrentSpeed(value);
    },
    [speed],
  );

  /**
   * Hold to pause.
   *
   * `maxDistance` is left at its default on purpose: a finger that moves is
   * scrolling, not holding, so the gesture bows out and the scroll view takes
   * the touch.
   */
  const holdGesture = useMemo(
    () =>
      Gesture.LongPress()
        .minDuration(T.longPressMs)
        .shouldCancelWhenOutside(false)
        .onStart(() => {
          holding.value = true;
        })
        .onFinalize(() => {
          holding.value = false;
        }),
    [holding],
  );

  return (
    <>
      <Stack.Toolbar placement="right">
        {/* The button *is* the current speed — there is no icon that says
            "1.25x", and a speedometer glyph would need tapping to answer the
            only question anyone has about it. */}
        <Stack.Toolbar.Menu title="Scroll speed" accessibilityLabel="Scroll speed">
          <Stack.Toolbar.Label>{speedLabel(currentSpeed)}</Stack.Toolbar.Label>
          {T.speeds.map((value) => (
            <Stack.Toolbar.MenuAction
              key={value}
              isOn={value === currentSpeed}
              onPress={() => pickSpeed(value)}
            >
              {speedLabel(value)}
            </Stack.Toolbar.MenuAction>
          ))}
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>

      <View style={[styles.screen, { backgroundColor: screenColor }]}>
        {lines.length > 0 ? (
          <GestureDetector gesture={holdGesture}>
            <Animated.ScrollView
              ref={scrollRef}
              onLayout={onViewportLayout}
              onContentSizeChange={onContentSizeChange}
              onScroll={onScroll}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={false}
              contentInsetAdjustmentBehavior="never"
              contentContainerStyle={{
                // The first line starts on the focus mark and the last one can
                // still reach it, so the prompt runs out at the right moment
                // instead of stranding its ending halfway down the screen.
                paddingTop: viewportHeight * T.focusRatio,
                paddingBottom: viewportHeight * (1 - T.focusRatio),
                paddingHorizontal: 26,
              }}
            >
              {lines.map((line, index) => (
                <PromptLineView
                  key={index}
                  line={line}
                  offset={offset}
                  focusY={focusY}
                  color={inkColor}
                  accent={colors.rust}
                />
              ))}
            </Animated.ScrollView>
          </GestureDetector>
        ) : isLoading ? (
          <ActivityIndicator style={styles.loading} />
        ) : (
          <Text style={styles.empty}>No script found.</Text>
        )}

        {/* The header is transparent, so lines would otherwise slide up
            behind the title, and down behind the button. Both edges fade into
            the page colour instead — which is also how a real prompter reads:
            the line you want is the one in the clear. */}
        <LinearGradient
          pointerEvents="none"
          colors={[screenColor, fadedScreenColor]}
          style={[styles.fadeTop, { height: insets.top + 96 }]}
        />
        <LinearGradient
          pointerEvents="none"
          colors={[fadedScreenColor, screenColor]}
          style={[styles.fadeBottom, { height: insets.bottom + 132 }]}
        />

        <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
          <StartButton started={started} running={isRunning} onPress={toggle} />
        </View>
      </View>
    </>
  );
};

export default TeleprompterScreen;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  footer: {
    alignItems: "center",
    paddingTop: 10,
  },
  fadeTop: { position: "absolute", left: 0, right: 0, top: 0 },
  fadeBottom: { position: "absolute", left: 0, right: 0, bottom: 0 },
  loading: { marginTop: 80 },
  empty: {
    fontFamily: fonts.amarna.regular,
    fontSize: 16,
    opacity: 0.4,
    textAlign: "center",
    marginTop: 80,
  },
});
