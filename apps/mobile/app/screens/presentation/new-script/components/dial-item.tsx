import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Icon from "@react-native-vector-icons/lucide";
import Animated, {
  SharedValue,
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";

import { fonts } from "@/constants/fonts";
import type { DialOption } from "./dial-data";
import {
  BUBBLE,
  CX,
  ITEM_R,
  ITEM_W,
  RING_R,
  STEP_C,
  arcCenterY,
  focusCenterY,
  ringMaxD,
  ringStep,
  wrapD,
} from "./dial-geometry";

interface DialItemProps {
  option: DialOption;
  /** Position in its own list. */
  index: number;
  /** Which of the three dials this belongs to. */
  dial: number;
  count: number;
  /** Continuous selection, in option units. */
  raw: SharedValue<number>;
  /** The dial being dragged, or -1. */
  focus: SharedValue<number>;
  /** 0..1 — how far the focused dial has opened. */
  expansion: SharedValue<number>;
  /** The settled selection of the focused dial, springing between whole
   *  options. What sits in the middle of the ring is read off this rather than
   *  off `raw`, so the active value snaps to the centre and stays there for the
   *  rest of the detent instead of drifting under the finger. */
  snapped: SharedValue<number>;
  /** Height of the step, measured. All the geometry hangs off it. */
  height: number;
  /** Label colour, on the band's own fill. */
  ink: string;
  /** Icon colour, inside the white bubble. */
  glyph: string;
}

/**
 * One option, drawn as a point on a circle.
 *
 * Collapsed and focused are the same layout with different numbers: a centre,
 * a radius and an angle per step. So opening the dial is an interpolation
 * rather than a second component — the bubbles fly off the arc and settle into
 * the ring along a path they were always on.
 */
function DialItem({
  option,
  index,
  dial,
  count,
  raw,
  focus,
  expansion,
  snapped,
  height,
  ink,
  glyph,
}: DialItemProps) {
  const style = useAnimatedStyle(() => {
    // `focus` and `expansion` are read here rather than through a helper:
    // Reanimated works out a style's dependencies from the worklet itself, and
    // a value only touched inside a function it calls goes untracked.
    const e = focus.value === dial ? expansion.value : 0;
    // Both dials wrap, so an option's place is its distance the short way round.
    const d = wrapD(index - raw.value, count);
    const ad = Math.abs(d);

    const step = STEP_C + (ringStep(count) - STEP_C) * e;
    const theta = d * step;

    // Focused, the selection is pulled into the middle and everything else
    // fans out onto a ring around it. Measured from the *settled* selection,
    // not the live one: turning within a detent leaves the active value sitting
    // in the middle, and crossing into the next one hands the middle over as a
    // spring — one flies out along the ring, the other flies in.
    const sd = wrapD(index - snapped.value, count);
    const pull = 1 - Math.min(1, Math.abs(sd));
    const radius = ITEM_R + (RING_R * (1 - pull) - ITEM_R) * e;

    const arc = arcCenterY(height, dial);
    const cy = arc + (focusCenterY(height) - arc) * e;

    const flat = interpolate(Math.min(ad, 2), [0, 1, 2], [1.12, 0.88, 0.8]);
    // Sized off the settled selection too, so the middle one stays big for the
    // whole detent rather than shrinking as the finger moves off it.
    const open = interpolate(
      Math.min(Math.abs(sd), 2),
      [0, 0.8, 2],
      [1.9, 0.95, 0.86],
    );

    const maxD = ringMaxD(count);
    // Gone before the second neighbour, which is where the arc runs off the
    // side of the screen — now that the list wraps there is always another
    // option out there, and a half-clipped one reads as a mistake.
    const flatOpacity = interpolate(ad, [0, 1, 1.85], [1, 0.72, 0], "clamp");
    const openOpacity = interpolate(ad, [maxD - 0.6, maxD], [1, 0], "clamp");

    return {
      opacity: flatOpacity + (openOpacity - flatOpacity) * e,
      transform: [
        { translateX: CX + radius * Math.sin(theta) - ITEM_W / 2 },
        { translateY: cy - radius * Math.cos(theta) - BUBBLE / 2 },
        { scale: flat + (open - flat) * e },
      ],
    };
  });

  return (
    <Animated.View style={[styles.item, style]} pointerEvents="none">
      <View style={styles.bubble}>
        {option.emoji ? (
          <Text style={styles.emoji}>{option.emoji}</Text>
        ) : (
          <Icon name={option.icon ?? "circle"} size={24} color={glyph} />
        )}
      </View>
      <Text numberOfLines={2} style={[styles.label, { color: ink }]}>
        {option.short}
      </Text>
    </Animated.View>
  );
}

export default memo(DialItem);

const styles = StyleSheet.create({
  item: {
    position: "absolute",
    left: 0,
    top: 0,
    width: ITEM_W,
    alignItems: "center",
    // Every item is placed by transform from the same origin, so the box has to
    // grow up from the bubble's centre rather than its own.
    transformOrigin: [ITEM_W / 2, BUBBLE / 2, 0],
  },
  bubble: {
    width: BUBBLE,
    height: BUBBLE,
    borderRadius: BUBBLE / 2,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: { fontSize: 29, lineHeight: 35 },
  label: {
    marginTop: 7,
    fontSize: 12,
    lineHeight: 15,
    textAlign: "center",
    fontFamily: fonts.alanSans.medium,
  },
});
