/* eslint-disable react-hooks/immutability -- `raw` is a shared value owned by
   the screen and written from worklets; the rule can't see that a SharedValue
   is meant to be mutated. */
import { memo, useCallback, useMemo } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { haptics, weight } from "@/lib/haptics";
import Animated, {
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { fonts } from "@/constants/fonts";

const { width: W } = Dimensions.get("window");
const CX = W / 2;

/** Radius of the ruler's arc. Its centre sits far below the panel, which is
 *  what keeps the curve as shallow as the design's. */
const RULER_R = W;
/** Points of arc per whole unit. The drag is measured in the same units, so the
 *  ruler travels exactly with the finger. */
const UNIT_TRAVEL = 118;
const UNIT_ANGLE = UNIT_TRAVEL / RULER_R;
/** Minor ticks between whole numbers. */
const SUBDIV = 5;
/** Units of ruler drawn either side of the middle. Enough to run off both edges
 *  of the screen, which is all that has to be covered. */
const SPAN = 2.6;

const ARC_TOP = 26;
const ARC_CY = ARC_TOP + RULER_R;
const LABEL_R = RULER_R - 60;

const TICKS = (() => {
  const out: { a: number; major: boolean }[] = [];
  const end = Math.round(SPAN * SUBDIV);
  for (let j = -end; j <= end; j++) {
    out.push({ a: (j / SUBDIV) * UNIT_ANGLE, major: j % SUBDIV === 0 });
  }
  return out;
})();

/** Neighbours whose numbers are printed on the arc, in units from the middle.
 *  Only the immediate ones: past those the arc has left the screen. */
const LABELS = [-1, 1];

const PANEL = "#17171B";
const TICK = "#6C6C74";
const TICK_MAJOR = "#AFAFB6";

interface ValueDialProps {
  /** The settled number. Also what the printed neighbours count from. */
  value: number;
  min: number;
  max: number;
  unit: string;
  presets: number[];
  /** Pointer, chip outline, and the highlight on the middle tick. */
  accent: string;
  /** How many units make a group worth feeling differently — the cards dial
   *  passes its per-plate count, so crossing into a new plate is a firmer tick
   *  than crossing a single card. Left out, every detent feels the same. */
  group?: number;
  onChange: (value: number) => void;
  /** Continuous position, owned by the screen so the artwork above can be drawn
   *  from the same number the ruler is. */
  raw: SharedValue<number>;
}

/**
 * The dark half: a ruler that turns under a fixed pointer, the number it has
 * landed on, and three presets.
 *
 * The ruler is drawn once, three units wide, and rotated by the *fractional*
 * part of the position only. Every unit of it looks like every other, so the
 * step back at each whole number lands the pattern exactly on itself and cannot
 * be seen — while the printed neighbours, which live inside the same rotation,
 * change to the numbers that belong there. An infinite ruler out of a fixed
 * one, and one animated style for the whole thing.
 */
function ValueDial({
  value,
  min,
  max,
  unit,
  presets,
  accent,
  group,
  onChange,
  raw,
}: ValueDialProps) {
  /** Whole-number position, for the detent tick. */
  const stepped = useSharedValue(value);
  const start = useSharedValue(value);

  const commit = useCallback((next: number) => onChange(next), [onChange]);

  useAnimatedReaction(
    () => Math.round(raw.value),
    (next, previous) => {
      if (previous !== null && next !== previous) scheduleOnRN(commit, next);
    },
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(4)
        .onStart(() => {
          start.value = raw.value;
          stepped.value = Math.round(raw.value);
        })
        .onUpdate((e) => {
          // Dragging left pulls the higher numbers towards the pointer, the way
          // the ruler is printed.
          const next = start.value - e.translationX / UNIT_TRAVEL;
          raw.value = Math.min(Math.max(next, min), max);

          const detent = Math.round(raw.value);
          if (detent !== stepped.value) {
            // Crossing into a new group is a different event from crossing a
            // single unit — on the cards dial it adds or takes a plate off the
            // deck — so it gets a firmer tick. Pulsar's presets are worklets,
            // so both land on the UI thread with the crossing rather than a hop
            // through JS a frame later.
            if (
              group !== undefined &&
              Math.floor(detent / group) !== Math.floor(stepped.value / group)
            ) {
              haptics.select();
            } else {
              weight.tick();
            }
            stepped.value = detent;
          }
        })
        .onFinalize(() => {
          const settled = Math.min(Math.max(Math.round(raw.value), min), max);
          raw.value = withSpring(settled, { damping: 70 });
        }),
    [group, max, min, raw, start, stepped],
  );

  // Only the fraction: the whole part is carried by the numbers printed on it.
  const rulerStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${-(raw.value - Math.round(raw.value)) * UNIT_ANGLE}rad` },
    ],
  }));

  const choose = useCallback(
    (next: number) => {
      weight.press();
      raw.value = withSpring(next, { damping: 70 });
      onChange(next);
    },
    [onChange, raw],
  );

  const neighbours = useMemo(
    () =>
      LABELS.map((d) => ({ d, n: value + d })).filter(
        (l) => l.n >= min && l.n <= max,
      ),
    [max, min, value],
  );

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.root}>
        <View style={styles.rulerBox}>
          <Animated.View
            style={[
              styles.ruler,
              { transformOrigin: [CX, ARC_CY, 0] },
              rulerStyle,
            ]}
            pointerEvents="none"
          >
            {TICKS.map((t, i) => (
              <View
                key={i}
                style={[
                  styles.tick,
                  t.major ? styles.tickMajor : null,
                  {
                    top: ARC_CY - RULER_R - (t.major ? 13 : 7),
                    transform: [
                      { translateX: RULER_R * Math.sin(t.a) },
                      { translateY: RULER_R * (1 - Math.cos(t.a)) },
                      { rotate: `${t.a}rad` },
                    ],
                  },
                ]}
              />
            ))}
            {neighbours.map((l) => {
              const a = l.d * UNIT_ANGLE;
              return (
                <Text
                  key={l.d}
                  style={[
                    styles.neighbour,
                    {
                      top: ARC_CY - LABEL_R - 13,
                      transform: [
                        { translateX: LABEL_R * Math.sin(a) },
                        { translateY: LABEL_R * (1 - Math.cos(a)) },
                      ],
                    },
                  ]}
                >
                  {l.n}
                </Text>
              );
            })}
          </Animated.View>

          {/* The mark the ruler is read against. Outside the rotation, because
              it is the one thing that does not move. */}
          <View
            style={[styles.pointer, { backgroundColor: accent }]}
            pointerEvents="none"
          />

          <View style={styles.readout} pointerEvents="none">
            <Text style={styles.value}>{value}</Text>
            <Text style={styles.unit}>{unit}</Text>
          </View>
        </View>

        <View style={styles.chips}>
          {presets.map((p) => {
            const on = p === value;
            return (
              <Pressable
                key={p}
                onPress={() => choose(p)}
                style={({ pressed }) => [
                  styles.chip,
                  on && { borderColor: accent },
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Text style={[styles.chipValue, on && { color: accent }]}>
                  {p}
                </Text>
                <Text style={styles.chipUnit}>{unit}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </GestureDetector>
  );
}

export default memo(ValueDial);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PANEL, paddingTop: 8 },
  rulerBox: { height: 214, overflow: "hidden" },
  ruler: { position: "absolute", left: 0, top: 0, right: 0, bottom: 0 },
  tick: {
    position: "absolute",
    left: CX - 1,
    width: 2,
    height: 14,
    borderRadius: 1,
    backgroundColor: TICK,
  },
  tickMajor: { height: 26, width: 2.5, backgroundColor: TICK_MAJOR },
  neighbour: {
    position: "absolute",
    left: CX - 40,
    width: 80,
    textAlign: "center",
    fontSize: 21,
    color: "#8A8A92",
    fontFamily: fonts.alanSans.medium,
  },
  pointer: {
    position: "absolute",
    left: CX - 2,
    top: ARC_TOP - 30,
    width: 4,
    height: 34,
    borderRadius: 2,
  },
  readout: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 84,
    alignItems: "center",
  },
  value: {
    fontSize: 62,
    lineHeight: 70,
    color: "#FFFFFF",
    fontFamily: fonts.alanSans.bold,
  },
  unit: {
    fontSize: 17,
    marginTop: -2,
    color: "#8A8A92",
    fontFamily: fonts.alanSans.regular,
  },
  chips: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 20,
    marginTop: 18,
  },
  chip: {
    flex: 1,
    height: 62,
    borderRadius: 31,
    borderWidth: 1.5,
    borderColor: "#33333B",
    alignItems: "center",
    justifyContent: "center",
  },
  chipValue: {
    fontSize: 21,
    color: "#FFFFFF",
    fontFamily: fonts.alanSans.bold,
  },
  chipUnit: {
    fontSize: 11,
    color: "#7C7C85",
    fontFamily: fonts.alanSans.regular,
  },
});
