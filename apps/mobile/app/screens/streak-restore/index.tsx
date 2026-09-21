/* eslint-disable react-hooks/immutability -- the values written below are
   Reanimated shared values driven from callbacks; the rule cannot see that a
   SharedValue is meant to be mutated. */
import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Presets } from "react-native-pulsar";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/lucide";

import { HandwrittenNote } from "@/components/ui/handwritten-note";
import { FlameIcon } from "@/screens/home/components/streak-icons";
import { dailyPracticeService } from "@/services/daily-practice.service";
import { useDailyStore } from "@/store/daily-store";
import { localDate } from "@/types/daily";
import {
  BlockedScene,
  BottomBlobs,
  BrokenStreakScene,
  RestoredScene,
} from "./scenes";
import { restoreColors, restoreFonts, restoreMotion as M } from "./theme";
import PressableScale from "@/components/ui/animated/PressableScale";

/**
 * Restore a broken streak.
 *
 * One screen, three states, because they are three moments of the same thing
 * rather than three destinations: the ask, the yellow it turns into, and the
 * dead end when this month's restore is already spent. Routing between them
 * would put a stack transition in the middle of the one animation the screen
 * exists for.
 *
 * The animation is the screen. Pressing the button pulls its sparks in;
 * releasing it grows the button's own colour out from behind itself until it is
 * the background of the restored state. See `restoreMotion` in theme.ts for the
 * beat-by-beat order — every duration and curve lives there.
 */

/**
 * The reveal, borrowed from the dial screen (new-script/step-2-delivery).
 *
 * A circle drawn ONCE at `ARC_R` and scaled, so growing it costs a transform
 * per frame rather than a layout pass. Its centre sits a full `ARC_R` below the
 * bottom of the screen, which puts its top edge exactly on the bottom edge at
 * rest — invisible — and means what rises is a shallow curve that flattens as
 * it grows, not a circle ballooning out of a button.
 *
 * Anchoring it to the screen rather than to the button is also what killed the
 * flicker: the button's rect is measured asynchronously and re-measured as the
 * page reflows under the growing disc, so the disc kept being re-anchored
 * mid-flight. The bottom of the screen cannot move.
 */
const arcRadius = (w: number) => w;
const targetRadius = (w: number, h: number) =>
  Math.hypot(w / 2, h + arcRadius(w)) * 1.06;

/** Restores allowed per calendar month. Mirrors RESTORES_PER_MONTH on the
 *  server, which is the one that actually enforces it — this copy only draws
 *  the "1 / 1" on the blocked screen. */
const RESTORES_PER_MONTH = 1;

type Phase = "ask" | "revealing" | "won" | "blocked";

/**
 * The short strokes flanking the button.
 *
 * Placed against the button's own box with negative offsets rather than by
 * margin: they sit OUTSIDE it on both sides, and a margin inside a centred row
 * pushes the button instead of moving the spark.
 */
const SPARKS = [
  { side: "left", out: 30, top: -4, rotate: "-38deg", h: 22 },
  { side: "left", out: 44, top: 26, rotate: "-4deg", h: 20 },
  { side: "left", out: 32, top: 54, rotate: "32deg", h: 18 },
  { side: "right", out: 30, top: -4, rotate: "38deg", h: 22 },
  { side: "right", out: 44, top: 26, rotate: "4deg", h: 20 },
  { side: "right", out: 32, top: 54, rotate: "-32deg", h: 18 },
] as const;

/**
 * One stroke beside the button.
 *
 * Its own component because rotation and the press scale have to live in the
 * SAME transform list — RN replaces the list rather than merging it, so a
 * static `rotate` in the style array silently drops the animated scale (or the
 * other way round, depending which is last).
 */
const Spark = memo(function Spark({
  spark,
  color,
  press,
}: {
  spark: (typeof SPARKS)[number];
  color: string;
  press: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [
      { rotate: spark.rotate },
      // Scales about the stroke's middle, so it shortens from both ends the
      // way a spark drawn by hand would.
      { scaleY: interpolate(press.value, [0, 1], [1, M.sparkPressScale]) },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.spark,
        {
          height: spark.h,
          backgroundColor: color,
          top: spark.top,
          ...(spark.side === "left"
            ? { left: -spark.out }
            : { right: -spark.out }),
        },
        style,
      ]}
    />
  );
});

export default function StreakRestoreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();

  const streak = useDailyStore((s) => s.streak);
  const setStreak = useDailyStore((s) => s.setStreak);

  const [phase, setPhase] = useState<Phase>(
    streak?.restoreUsedThisMonth ? "blocked" : "ask",
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const press = useSharedValue(0);
  const reveal = useSharedValue(0);
  const won = useSharedValue(0);

  const ARC_R = arcRadius(W);
  const CIRCLE_R = targetRadius(W, H);

  // Guards a second tap while the first is still in flight — the button fades
  // under the reveal but is still mounted, and two restores would spend two
  // months' worth of allowance on one lapse.
  const committed = useRef(false);

  // The cached flag is good enough for the first paint, but not to refuse on:
  // it is written by whichever screen last fetched, and a restore spent on
  // another device — or a month that has since rolled over — leaves it saying
  // the opposite of what the server would. Re-reading on mount means the dead
  // end is only ever shown when the server agrees with it.
  useEffect(() => {
    // A simulated streak is the whole point of the dev section; re-reading the
    // server here would undo the button the person just pressed.
    if (streak?.simulated) return;

    let cancelled = false;
    dailyPracticeService
      .getStreak(localDate())
      .then((fresh) => {
        if (cancelled) return;
        setStreak(fresh);
        // Only while nothing is in flight — a reply that lands mid-animation
        // must not yank the screen out from under it.
        setPhase((current) =>
          current === "ask" || current === "blocked"
            ? fresh.restoreUsedThisMonth
              ? "blocked"
              : "ask"
            : current,
        );
      })
      .catch(() => {
        // Offline: the cached flag stands. The tap still goes to the server,
        // which is the thing that actually decides.
      });
    return () => {
      cancelled = true;
    };
  }, [setStreak, streak?.simulated]);

  const settle = useCallback(() => setPhase("won"), []);

  const unwind = useCallback(
    (message: string) => {
      committed.current = false;
      setBusy(false);
      setError(message);
      setPhase("ask");
      reveal.value = withTiming(0, {
        duration: M.revealOut,
        easing: M.easing.out,
      });
      press.value = withTiming(0, {
        duration: M.pressOut,
        easing: M.easing.press,
      });
    },
    [press, reveal],
  );

  const onPressIn = useCallback(() => {
    if (committed.current) return;
    press.value = withTiming(1, {
      duration: M.pressIn,
      easing: M.easing.press,
    });
    Presets.System.impactSoft();
  }, [press]);

  const onPressOut = useCallback(() => {
    // Only a release that did NOT commit springs the sparks back; a committed
    // one leaves them short, because they are about to be covered anyway and
    // snapping them back under the growing disc reads as a glitch.
    if (committed.current) return;
    press.value = withTiming(0, {
      duration: M.pressOut,
      easing: M.easing.press,
    });
  }, [press]);

  const onRestore = useCallback(async () => {
    if (committed.current || phase !== "ask") return;
    committed.current = true;
    setError(null);
    setBusy(true);
    setPhase("revealing");
    Presets.System.selection();

    // The reveal starts on the release, not on the response. It is the answer
    // to the tap, and holding it until the network replies would put a dead
    // half-second exactly where the screen promises its one piece of delight.
    // A failure unwinds it (see `unwind`), which is the rarer path.
    // The circle grows from the bottom edge and covers everything. The
    // restored state is started from its completion callback rather than on a
    // delay of its own: the two must not overlap — the new screen appears on a
    // canvas that is already its colour, which is the whole point of the
    // reveal.
    reveal.value = withDelay(
      M.revealDelay,
      withTiming(1, { duration: M.reveal, easing: M.easing.reveal }, (done) => {
        "worklet";
        if (!done) return;
        won.value = withTiming(
          1,
          { duration: M.wonIn, easing: M.easing.won },
          (finished) => {
            "worklet";
            if (finished) runOnJS(settle)();
          },
        );
      }),
    );

    try {
      const next = await dailyPracticeService.restoreStreak(localDate());
      // The store write is all that is needed — the widget subscription in
      // lib/widget-sync pushes the new number without this screen knowing a
      // widget exists.
      setStreak(next);
      setBusy(false);
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 409) {
        // "Already used this month" — but by whom, and when? If our own store
        // already shows a live streak restored this month, the restore that
        // spent it is the one we just made: a duplicate request (a double tap,
        // a second mount of this screen) racing the first. Showing the dead end
        // then would tell the person their restore failed when it plainly did
        // not, and the yellow they are already looking at would snap away.
        const mine = useDailyStore.getState().streak;
        if (mine?.restoreUsedThisMonth && (mine.currentStreak ?? 0) > 0) {
          setBusy(false);
          return;
        }

        // Genuinely spent elsewhere — another device, or a month that rolled
        // over under us. Not an error; it is the other state.
        committed.current = false;
        setBusy(false);
        reveal.value = withTiming(0, {
          duration: M.revealOut,
          easing: M.easing.out,
        });
        won.value = 0;
        press.value = withTiming(0, { duration: M.pressOut });
        setPhase("blocked");
        return;
      }
      unwind(
        status === 400
          ? "There's no broken streak to restore."
          : "Couldn't reach the server. Your streak is unchanged.",
      );
    }
  }, [phase, press, reveal, setStreak, settle, unwind, won]);

  // --- styles ----------------------------------------------------------------

  // Same construction as the dial screen's reveal: translate the drawn circle
  // so its centre sits below the screen, then scale it up in place.
  const discStyle = useAnimatedStyle(() => ({
    opacity: reveal.value > 0 ? 1 : 0,
    transform: [
      { translateX: W / 2 - ARC_R },
      { translateY: H + ARC_R - ARC_R },
      { scale: 1 + (CIRCLE_R / ARC_R - 1) * reveal.value },
    ],
  }));

  const askStyle = useAnimatedStyle(() => ({
    // Tied to the disc, and late: the words have to be gone by the time the
    // yellow reaches them, but going at 0.28 emptied the page well before it
    // arrived and left a blank cream band above the curve. This window is
    // roughly where the edge crosses the copy.
    opacity: interpolate(
      reveal.value,
      [0.3, 0.62],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const wonStyle = useAnimatedStyle(() => ({
    opacity: won.value,
    transform: [{ translateY: interpolate(won.value, [0, 1], [18, 0]) }],
  }));

  // --- the three states ------------------------------------------------------

  if (phase === "blocked") {
    return (
      <BlockedState
        onDismiss={() => router.back()}
        topInset={insets.top}
        width={W}
        height={H}
      />
    );
  }

  const c = phase === "won" ? restoreColors.won : restoreColors.ask;
  const showAsk = phase !== "won";

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: phase === "won" ? restoreColors.won.bg : c.bg },
      ]}
    >
      {/* The ask, fading out under the disc. Kept mounted through the reveal so
          it is covered rather than removed — unmounting it would pop a hole in
          the middle of the animation. */}
      {showAsk && (
        <Animated.View style={[styles.fill, askStyle]} pointerEvents="box-none">
          <HandwrittenNote
            lines={["Oops...", "Streaks break", "sometimes."]}
            arrowSize={50}
            color={restoreColors.ask.note}
            fontSize={16}
            flip
            style={{ right: 16, top: insets.top + 2 }}
          />
          <HandwrittenNote
            lines={["Don't worry!", "You can", "bring it back."]}
            arrowSize={46}
            color={restoreColors.ask.note}
            fontSize={15}
            style={{ left: 16, top: insets.top + 86 }}
          />

          <View style={styles.bottomBlobs} pointerEvents="none">
            <BottomBlobs width={W} height={W * 0.47} />
          </View>

          {/* Scene and copy in flow, not at percentage offsets: the two were
              overlapping on shorter phones, and a stage that simply centres
              what it is given cannot. */}
          <View style={[styles.stage, { paddingTop: insets.top + 46 }]}>
            <View pointerEvents="none">
              <BrokenStreakScene width={W} />
            </View>
            <View style={styles.copy}>
              <Text style={[styles.title, { color: restoreColors.ask.ink }]}>
                Restore{"\n"}Your Streak?
              </Text>
              <Text style={[styles.blurb, { color: restoreColors.ask.body }]}>
                Life happens! Tap below to bring your streak back.
              </Text>
            </View>
          </View>

          {/* In flow under the stage. It fades with the rest of the ask, but
              keeps its layout — the disc grows from where the button is. */}
          <View
            style={[styles.footer, { paddingBottom: insets.bottom + H * 0.15 }]}
            pointerEvents={phase === "ask" ? "box-none" : "none"}
          >
            <View style={styles.buttonRow}>
              {SPARKS.map((spark, i) => (
                <Spark
                  key={i}
                  spark={spark}
                  color={restoreColors.ask.spark}
                  press={press}
                />
              ))}
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Restore your streak"
                disabled={phase !== "ask"}
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                onPress={onRestore}
                style={[
                  styles.cta,
                  { backgroundColor: restoreColors.ask.button },
                ]}
              >
                {busy && phase === "ask" ? (
                  <ActivityIndicator color={restoreColors.ask.buttonInk} />
                ) : (
                  <FlameIcon size={32} />
                )}
                <Text
                  style={[
                    styles.ctaLabel,
                    { color: restoreColors.ask.buttonInk },
                  ]}
                >
                  Restore Streak
                </Text>
              </PressableScale>
            </View>

            {error ? (
              <Text style={styles.error}>{error}</Text>
            ) : (
              <PressableScale
                accessibilityRole="button"
                onPress={() => router.back()}
                hitSlop={12}
              >
                <Text style={[styles.later, { color: restoreColors.ask.body }]}>
                  Maybe Later
                </Text>
              </PressableScale>
            )}
          </View>

          <HandwrittenNote
            lines={["Same", "progress,", "brighter days."]}
            arrowSize={40}
            color={restoreColors.ask.note}
            fontSize={13.5}
            style={{ left: 12, bottom: insets.bottom + 8 }}
          />
        </Animated.View>
      )}

      {/* The reveal. Anchored to the screen, so it needs nothing measured and
          nothing can move it once it is running. It sits above the ask and
          below the restored state, which is exactly the order it reads in:
          the colour buries the question, then the new screen appears on it. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.disc,
          {
            width: ARC_R * 2,
            height: ARC_R * 2,
            borderRadius: ARC_R,
            backgroundColor: restoreColors.won.bg,
          },
          discStyle,
        ]}
      />

      {/* The restored state, on a canvas that is already its colour. */}
      {phase !== "ask" && (
        <Animated.View
          style={[styles.fill, wonStyle]}
          pointerEvents={phase === "won" ? "box-none" : "none"}
        >
          <HandwrittenNote
            lines={["Streak", "Restored!"]}
            arrowSize={54}
            color={restoreColors.won.note}
            flip
            style={{ right: 20, top: insets.top + 40 }}
          />
          <HandwrittenNote
            lines={["You're", "back!"]}
            arrowSize={46}
            color={restoreColors.won.note}
            style={{ left: 20, top: insets.top + 196 }}
          />

          <View style={[styles.stage, { paddingTop: insets.top + 40 }]}>
            <View pointerEvents="none">
              <RestoredScene width={W * 0.84} />
            </View>
            <View style={styles.copy}>
              <Text style={[styles.title, { color: restoreColors.won.ink }]}>
                Streak{"\n"}Restored!
              </Text>
              <Text style={[styles.wonLead, { color: restoreColors.won.body }]}>
                And we&rsquo;re so back!
              </Text>
              <Text style={[styles.blurb, { color: restoreColors.won.body }]}>
                Consistency hits different.{"\n"}Keep it going!
              </Text>
            </View>
          </View>

          <View style={[styles.footer, { paddingBottom: insets.bottom + 26 }]}>
            <PressableScale
              accessibilityRole="button"
              onPress={() => router.back()}
              style={[
                styles.cta,
                { backgroundColor: restoreColors.won.button },
              ]}
            >
              <FlameIcon size={30} />
              <Text
                style={[
                  styles.ctaLabel,
                  { color: restoreColors.won.buttonInk },
                ]}
              >
                Let&rsquo;s Go!
              </Text>
              <Icon
                name="arrow-right"
                size={22}
                color={restoreColors.won.buttonInk}
              />
            </PressableScale>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

/**
 * The cap, as its own component.
 *
 * Nothing about it animates, so it does not share the machinery above — and
 * keeping it separate means the reveal's shared values are not created on a
 * screen that can never run it.
 */
function BlockedState({
  onDismiss,
  topInset,
  width,
  height,
}: {
  onDismiss: () => void;
  topInset: number;
  width: number;
  height: number;
}) {
  const insets = useSafeAreaInsets();
  const c = restoreColors.blocked;

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <HandwrittenNote
        lines={["Only 1", "restore", "per month"]}
        arrowSize={50}
        color={c.note}
        flip
        fontSize={15}
        style={{ right: 16, top: topInset + 2 }}
      />
      <HandwrittenNote
        lines={["You've already", "used it this", "month."]}
        arrowSize={44}
        color={c.note}
        fontSize={14.5}
        style={{ left: 14, top: topInset + 86 }}
      />

      <View style={styles.bottomBlobs} pointerEvents="none">
        <BottomBlobs width={width} height={width * 0.47} />
      </View>

      {/* Same stage-then-footer flow as the ask state. It used to position its
          own pieces absolutely, which is why it came apart when that layout
          changed — one structure for both states now. */}
      <View style={[styles.stage, { paddingTop: topInset + 46 }]}>
        <View pointerEvents="none">
          <BlockedScene
            width={width}
            used={RESTORES_PER_MONTH}
            allowed={RESTORES_PER_MONTH}
          />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.titleTight, { color: c.ink }]}>
            You&rsquo;ve already used your restore this month
          </Text>
          <Text style={[styles.blurb, { color: c.body }]}>
            You can only restore your streak once per month. Keep showing up and
            let&rsquo;s make the next one count!
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.footer,
          { paddingBottom: insets.bottom + height * 0.13 },
        ]}
      >
        {/* Present but refusing. A hidden button would leave the screen
            explaining a control that is not there. */}
        <View
          style={[styles.cta, styles.ctaDead, { backgroundColor: c.button }]}
          accessible
          accessibilityRole="button"
          accessibilityState={{ disabled: true }}
          accessibilityLabel="Restore streak, unavailable until next month"
        >
          <FlameIcon size={32} />
          <Text style={[styles.ctaLabel, { color: c.buttonInk }]}>
            Restore Streak
          </Text>
        </View>
        <PressableScale
          accessibilityRole="button"
          onPress={onDismiss}
          hitSlop={12}
        >
          <Text style={[styles.later, { color: c.body }]}>Got it</Text>
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },

  /** Everything above the footer: the illustration and the words under it,
   *  centred together in whatever room the footer leaves. */
  stage: {
    flex: 1,
    alignItems: "center",
    // Top-aligned, not centred: the illustration belongs just under the header
    // and the slack belongs between the blurb and the button, which is where
    // the reference puts it. Centring shared the slack top and bottom and
    // pushed the scene into the middle of the screen.
    justifyContent: "flex-start",
    gap: 22,
  },
  scene: { position: "absolute", left: 0, right: 0, top: "24%" },
  bottomBlobs: { position: "absolute", left: 0, right: 0, bottom: 0 },

  copy: {
    alignSelf: "stretch",
    paddingHorizontal: 44,
    alignItems: "center",
    gap: 10,
  },
  title: {
    fontFamily: restoreFonts.display,
    fontSize: 42,
    lineHeight: 47,
    textAlign: "center",
    letterSpacing: -1,
  },
  titleTight: {
    fontFamily: restoreFonts.display,
    fontSize: 32,
    lineHeight: 39,
    textAlign: "center",
    letterSpacing: -0.6,
  },
  wonLead: {
    fontFamily: restoreFonts.bold,
    fontSize: 21,
    textAlign: "center",
  },
  blurb: {
    fontFamily: restoreFonts.regular,
    fontSize: 16.5,
    lineHeight: 23,
    textAlign: "center",
  },

  /** In flow under the stage, not floated over it: the note in the bottom-left
   *  corner has to be able to sit below the button rather than behind it. */
  footer: { alignItems: "center", gap: 16, paddingTop: 8 },
  // The sparks are positioned against this row, so it is the thing measured.
  buttonRow: { alignItems: "center", justifyContent: "center" },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    height: 68,
    paddingHorizontal: 34,
    minWidth: 268,
    borderRadius: 34,
  },
  ctaDead: { opacity: 0.85 },
  ctaLabel: { fontFamily: restoreFonts.bold, fontSize: 21 },
  later: { fontFamily: restoreFonts.semiBold, fontSize: 16 },
  error: {
    fontFamily: restoreFonts.semiBold,
    fontSize: 14.5,
    textAlign: "center",
    paddingHorizontal: 32,
    color: "#C2453D",
  },

  spark: {
    position: "absolute",
    width: 6,
    borderRadius: 3,
  },
  // Size and radius come from the screen width at render time; only the
  // positioning is fixed here.
  disc: { position: "absolute", left: 0, top: 0 },
});
