/* eslint-disable react-hooks/immutability -- `raw`, `activePill` and
   `interacting` are shared values owned by the parent and written from
   worklets; the rule can't see that a SharedValue is meant to be mutated. */
import { memo, useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { Presets } from "react-native-pulsar";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  SharedValue,
  interpolateColor,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { fonts } from "@/constants/fonts";

/** The pill never sinks below this share of the track, or the value inside it
 *  would have nowhere to sit. The last option fills the track outright. */
const MIN_FILL = 0.35;
const MAX_FILL = 1;
/** Grey every colour collapses toward while another control is being dragged. */
const MUTED = "#D9D7D4";
const INK = "#1B1B1B";
const MUTED_INK = "#B4B0AC";

function clampw(value: number, min: number, max: number) {
  "worklet";
  return Math.min(Math.max(value, min), max);
}

interface PillPickerProps {
  /** Position in the row, matched against `activePill`. */
  id: number;
  caption: string;
  options: string[];
  index: number;
  onChange: (index: number) => void;
  color: string;
  /** Flex weight — audience is the wide one in the design. */
  weight: number;
  /** Continuous position in option units. Owned by the card so the ruler can
   *  read the same value the pill is drawn from. */
  raw: SharedValue<number>;
  /** -1 when nothing is being dragged, else the `id` of the pill that is. */
  activePill: SharedValue<number>;
  /** 0..1 fade into the muted, greyed-out state. */
  interacting: SharedValue<number>;
}

function PillPicker({
  id,
  caption,
  options,
  index,
  onChange,
  color,
  weight,
  raw,
  activePill,
  interacting,
}: PillPickerProps) {
  const last = options.length - 1;
  const start = useSharedValue(index);
  /** The whole-step position. The gesture only ever writes here; React hears
   *  about it through the reaction below. */
  const stepped = useSharedValue(index);
  // Signed, from the gesture's velocity — this is the whole liquid effect.
  const stretch = useSharedValue(0);
  const trackHeight = useSharedValue(1);

  const commit = useCallback((next: number) => onChange(next), [onChange]);

  // Nothing in here closes over a JS callback, so the gesture object is built
  // once and handed to GestureDetector unchanged. That matters: a gesture
  // swapped mid-drag loses its end callbacks, which is what used to leave the
  // card greyed out after the finger came up.
  const pan = Gesture.Pan()
    // Vertical only — a horizontal drag belongs to the stack's back gesture.
    .activeOffsetY([-8, 8])
    .failOffsetX([-16, 16])
    .onBegin(() => {
      activePill.value = id;
      interacting.value = withTiming(1, { duration: 180 });
      start.value = raw.value;
      stepped.value = Math.round(raw.value);
    })
    .onUpdate((e) => {
      // Dragging up raises the value, and the ruler is drawn bottom-up to match.
      const stepPx = trackHeight.value / Math.max(last, 1);
      raw.value = clampw(start.value - e.translationY / stepPx, 0, last);
      stretch.value = clampw(e.velocityY / 4000, -0.14, 0.14);

      const next = Math.round(raw.value);
      if (next !== stepped.value) {
        stepped.value = next;
        // Pulsar's presets are worklets, so the tick lands on the UI thread with
        // the crossing rather than a hop through JS later.
        Presets.System.selection();
      }
    })
    .onFinalize(() => {
      const settled = clampw(Math.round(raw.value), 0, last);
      stepped.value = settled;
      raw.value = withSpring(settled, { damping: 50 });
      stretch.value = withSpring(0, { damping: 50 });
      // Cleared only once the fade is done: dropping it now would grey the pill
      // the user just dragged for the length of the release. The id check keeps
      // a late callback from stealing a newer drag's claim.
      interacting.value = withTiming(0, { duration: 260 }, (finished) => {
        if (finished && activePill.value === id) activePill.value = -1;
      });
    });

  // The one bridge back to React. Re-registering this on a render is harmless —
  // unlike the gesture, it holds no interaction state.
  useAnimatedReaction(
    () => stepped.value,
    (next, previous) => {
      if (previous !== null && next !== previous) runOnJS(commit)(next);
    },
  );

  // `activePill` and `interacting` are read inline in every style below rather
  // than through a shared helper: Reanimated works out which values a style
  // depends on by looking at the style worklet itself, and a value only touched
  // inside a function it calls goes unseen. That is what made the greying
  // arbitrary — a style would recompute on the values it did track (`raw`,
  // `stretch`) and keep whatever mute state it happened to catch.

  const fillStyle = useAnimatedStyle(() => {
    const mute = activePill.value === id ? 0 : interacting.value;
    const frac =
      MIN_FILL + (MAX_FILL - MIN_FILL) * (raw.value / Math.max(last, 1));
    return {
      height: `${frac * 100}%`,
      backgroundColor: interpolateColor(mute, [0, 1], [color, MUTED]),
      transform: [
        { scaleY: 1 + stretch.value },
        { scaleX: 1 - stretch.value * 0.5 },
      ],
    };
  });

  const captionStyle = useAnimatedStyle(() => {
    const mute = activePill.value === id ? 0 : interacting.value;
    return { color: interpolateColor(mute, [0, 1], [INK, MUTED_INK]) };
  });

  // Every in-pill label goes while anything is being changed — the ruler is the
  // only place a value is read during a drag.
  //
  // The width is the pill's own height, less a margin: the label is rotated a
  // quarter turn, so that is the space it actually has, and tying the two
  // together is what keeps a long name inside a short pill (it ellipsises
  // instead of spilling out of the shape).
  const valueStyle = useAnimatedStyle(() => {
    const frac =
      MIN_FILL + (MAX_FILL - MIN_FILL) * (raw.value / Math.max(last, 1));
    return {
      opacity: 1 - interacting.value,
      width: Math.max(56, frac * trackHeight.value - 22),
    };
  });

  return (
    <View style={[styles.column, { flex: weight }]}>
      <GestureDetector gesture={pan}>
        <View
          style={styles.track}
          onLayout={(e) => {
            trackHeight.value = e.nativeEvent.layout.height;
          }}
        >
          <Animated.View style={[styles.fill, fillStyle]}>
            {/* Set on its side, the way a chart labels an axis: the narrow
                pills are 60pt wide and 200 tall, so the length a name needs is
                the one direction there is room in. */}
            <View style={styles.valueSlot} pointerEvents="none">
              <Animated.Text
                numberOfLines={1}
                style={[styles.value, valueStyle]}
              >
                {options[index]}
              </Animated.Text>
            </View>
          </Animated.View>
        </View>
      </GestureDetector>

      <Animated.Text numberOfLines={1} style={[styles.caption, captionStyle]}>
        {caption}
      </Animated.Text>
    </View>
  );
}

export default memo(PillPicker);

const styles = StyleSheet.create({
  column: { gap: 10 },
  track: {
    flex: 1,
    backgroundColor: "#F1EFED",
    borderRadius: 999,
    justifyContent: "flex-end",
  },
  fill: {
    width: "100%",
    borderRadius: 999,
    justifyContent: "flex-end",
    // The stretch grows the pill up out of its base, the way a drip hangs.
    transformOrigin: "bottom",
  },
  // The label is centred on the pill by symmetry, which is the reliable way to
  // place rotated text in Yoga — the layout box never rotates, only the glyphs.
  valueSlot: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  value: {
    textAlign: "center",
    transform: [{ rotate: "-90deg" }],
    // Krona is a wide face, so this runs smaller than a system font would to
    // keep a name like "Healthcare / Medical" inside its pill.
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: 0.2,
    color: "rgba(27,27,27,0.88)",
    fontFamily: fonts.krona,
  },
  caption: {
    fontSize: 14,
    lineHeight: 18,
    textAlign: "center",
    letterSpacing: 0.1,
    color: INK,
    fontFamily: fonts.amarna.regular,
    textTransform: "capitalize",
  },
});
