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
  Easing,
  FadeInDown,
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
  /** How far the bottom fade goes. Short of opaque, on purpose. */
  const veiledScreenColor = colord(screenColor).alpha(T.bottomVeil).toHex();
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
  /** A finger is held on the left or right edge: run faster until it lifts. */
  const boosting = useSharedValue(false);
  const dragging = useSharedValue(false);
  /** Measured, because the zones are fractions of it. */
  const viewportWidth = useSharedValue(0);
  const speed = useSharedValue<number>(T.defaultSpeed);

  /**
   * Where the current run started, in time and in points.
   *
   * The loop used to add `speed * timeSincePreviousFrame` to the offset every
   * frame. That accumulates: a frame time that comes in a millisecond long or
   * short moves the text by a different amount than the frame before it, and
   * a few of those a second is exactly what reads as jitter — the text is
   * never still, it is just travelling unevenly. Anchoring to a start time
   * and deriving the position from the clock makes every frame land where it
   * belongs no matter when it is drawn, and drops the accumulated error too.
   *
   * -1 means "anchor on the next frame": set after anything that moves the
   * prompt without the loop — a pause, a hold, a drag, a speed change.
   */
  const anchorTime = useSharedValue(-1);
  const anchorOffset = useSharedValue(0);

  // React's copies. They drive the button and the toolbar only — never the
  // loop, which reads the shared values above.
  const [started, setStarted] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState<number>(T.defaultSpeed);
  // React's copy of the boost, for the toolbar. The loop reads the shared
  // value; this only decides what the button says.
  const [isBoosting, setIsBoosting] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(0);

  const stop = useCallback(() => setIsRunning(false), []);

  const loop = useFrameCallback((frame) => {
    "worklet";
    if (!running.value || maxOffset.value <= 0) return;

    // Held or dragged: the finger owns the position, so re-anchor to wherever
    // it leaves it rather than snapping back to where the clock would be.
    if (holding.value || dragging.value) {
      anchorTime.value = -1;
      return;
    }

    if (anchorTime.value < 0) {
      anchorTime.value = frame.timestamp;
      anchorOffset.value = offset.value;
      return;
    }

    const elapsed = (frame.timestamp - anchorTime.value) / 1000;
    const rate =
      T.basePixelsPerSecond *
      speed.value *
      (boosting.value ? T.boostMultiplier : 1);
    const travelled = rate * elapsed;
    // Deliberately NOT snapped to the pixel grid. Crisper glyphs, but at a
    // reading pace one frame's travel is about half a point — snapping made
    // consecutive frames land on the same pixel and then jump two, which
    // measured as 5% repeated frames and reads as exactly the stutter this
    // loop is trying to remove. Sub-pixel motion is the smoother trade.
    const next = Math.min(anchorOffset.value + travelled, maxOffset.value);

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
      anchorTime.value = -1;
    },
    // A flick released with velocity keeps gliding; while the prompt is
    // stopped that glide is the user's, so the loop must not resume from
    // where their finger left the glass.
    onMomentumEnd: (event) => {
      offset.value = event.contentOffset.y;
      anchorTime.value = -1;
    },
  });

  const onViewportLayout = (event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    viewport.value = height;
    viewportWidth.value = event.nativeEvent.layout.width;
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
    // A pause and a resume both start a new run from the current position.
    anchorTime.value = -1;
    setStarted(true);
    setIsRunning(next);
  }, [anchorTime, running]);

  const pickSpeed = useCallback(
    (value: number) => {
      speed.value = value;
      // The new rate applies from here, not from the start of the run —
      // without re-anchoring, changing speed would recompute the whole
      // elapsed distance and jump the text.
      anchorTime.value = -1;
      setCurrentSpeed(value);
    },
    [anchorTime, speed],
  );

  /**
   * Hold, and where you hold decides what it does.
   *
   * Middle: pause. Either edge: run at `boostMultiplier` until the finger
   * lifts. Both end the moment the touch does, and both re-anchor the clock
   * so the prompt carries on from where it actually is rather than where it
   * would have been.
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
        .onStart((event) => {
          const width = viewportWidth.value;
          const zone = width > 0 ? event.x / width : 0.5;
          if (zone > T.edgeZone && zone < 1 - T.edgeZone) {
            holding.value = true;
            return;
          }
          boosting.value = true;
          anchorTime.value = -1;
          scheduleOnRN(setIsBoosting, true);
        })
        .onFinalize(() => {
          holding.value = false;
          if (!boosting.value) return;
          boosting.value = false;
          anchorTime.value = -1;
          scheduleOnRN(setIsBoosting, false);
        }),
    [anchorTime, boosting, holding, viewportWidth],
  );

  // Nothing but the spinner until there are lines to show. The script is
  // already on disk, so this is a frame or two — long enough that a half-built
  // screen with a Start button on it would be worse than a clean wait.
  if (lines.length === 0) {
    return (
      <View style={[styles.screen, styles.centred, { backgroundColor: screenColor }]}>
        {isLoading ? (
          <ActivityIndicator size="large" color={inkColor} />
        ) : (
          <Text style={styles.empty}>No script found.</Text>
        )}
      </View>
    );
  }

  return (
    <>
      <Stack.Toolbar placement="right">
        {/* The button *is* the current speed — there is no icon that says
            "1.25x", and a speedometer glyph would need tapping to answer the
            only question anyone has about it. */}
        <Stack.Toolbar.Menu title="Scroll speed" accessibilityLabel="Scroll speed">
          {/* While a finger is on an edge this reads the boosted rate, not
              the one that is selected — the button's job is to say how fast
              the script is moving right now. The tick below stays on the
              chosen speed, which is what the boost is a multiple of. */}
          <Stack.Toolbar.Label>
            {speedLabel(
              isBoosting ? currentSpeed * T.boostMultiplier : currentSpeed,
            )}
          </Stack.Toolbar.Label>
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
        <GestureDetector gesture={holdGesture}>
          <Animated.ScrollView
            ref={scrollRef}
            onLayout={onViewportLayout}
            onContentSizeChange={onContentSizeChange}
            onScroll={onScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
            contentInsetAdjustmentBehavior="never"
            style={StyleSheet.absoluteFill}
            contentContainerStyle={{
              // The first line starts on the focus mark and the last one can
              // still reach it, so the prompt runs out at the right moment
              // instead of stranding its ending halfway down the screen.
              paddingTop: viewportHeight * T.focusRatio,
              paddingBottom: viewportHeight * (1 - T.focusRatio),
              paddingHorizontal: T.sidePadding,
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

        {/* The header is transparent and the button floats over the text, so
            both edges fade into the page colour instead of cutting. The
            bottom stops short of opaque: the script keeps moving behind the
            button, which is how you can tell it is still running. */}
        <LinearGradient
          pointerEvents="none"
          colors={[screenColor, fadedScreenColor]}
          style={[styles.fadeTop, { height: insets.top + 96 }]}
        />
        <LinearGradient
          pointerEvents="none"
          colors={[fadedScreenColor, veiledScreenColor]}
          locations={[0, 0.62]}
          style={[styles.fadeBottom, { height: insets.bottom + 168 }]}
        />

        <Animated.View
          entering={FadeInDown.duration(420)
            .easing(Easing.out(Easing.cubic))
            .delay(120)}
          style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}
        >
          <StartButton started={started} running={isRunning} onPress={toggle} />
        </Animated.View>
      </View>
    </>
  );
};

export default TeleprompterScreen;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centred: { alignItems: "center", justifyContent: "center" },
  /** Over the prompt, not below it: the text runs the full height of the
   *  screen and the button sits on top of it. */
  footer: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 0,
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
