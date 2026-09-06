import { fonts } from "@/constants/fonts";
import { memo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  SharedValue,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
} from "react-native-reanimated";

interface PillRulerProps {
  options: string[];
  /** Continuous position of the pill being dragged. */
  raw: SharedValue<number>;
  /** 0..1 — the ruler exists only for the duration of a drag. */
  interacting: SharedValue<number>;
}

/**
 * The value list, as a ruler pinned to the right of the card.
 *
 * It is drawn bottom-up (`column-reverse`): index 0 sits at the bottom, so a
 * drag upward moves the mark up and grows the pill by the same amount. Anchored
 * to the card rather than to the pill so a long list never runs off-screen,
 * whichever of the three is being dragged.
 */
function PillRuler({ options, raw, interacting }: PillRulerProps) {
  const style = useAnimatedStyle(() => ({ opacity: interacting.value }));

  return (
    <Animated.View style={[styles.ruler, style]} pointerEvents="none">
      {options.map((option, i) => (
        <Row key={option} i={i} label={option} raw={raw} />
      ))}
    </Animated.View>
  );
}

const Row = memo(
  ({
    i,
    label,
    raw,
  }: {
    i: number;
    label: string;
    raw: SharedValue<number>;
  }) => {
    const labelStyle = useAnimatedStyle(() => {
      const d = Math.abs(raw.value - i);
      return {
        opacity: interpolate(d, [0, 1, 2.5], [1, 0.4, 0.08], "clamp"),
        transform: [{ scale: interpolate(d, [0, 1], [1, 0.88], "clamp") }],
      };
    });

    const lineStyle = useAnimatedStyle(() => {
      const d = Math.abs(raw.value - i);
      return {
        width: interpolate(d, [0, 1, 3], [64, 46, 30], "clamp"),
        opacity: interpolate(d, [0, 1, 3], [1, 0.6, 0.25], "clamp"),
        backgroundColor: interpolateColor(
          Math.min(d, 1),
          [0, 1],
          ["#4A4744", "#B5B2AF"],
        ),
      };
    });

    return (
      <View style={styles.row}>
        <Animated.Text numberOfLines={1} style={[styles.label, labelStyle]}>
          {label}
        </Animated.Text>
        <Animated.View style={[styles.line, lineStyle]} />
      </View>
    );
  },
);
Row.displayName = "Row";

export default memo(PillRuler);

const styles = StyleSheet.create({
  ruler: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 240,
    // Bottom-up, so the mark travels with the pill rather than against it.
    flexDirection: "column-reverse",
    justifyContent: "space-evenly",
    alignItems: "flex-end",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  label: {
    flexShrink: 1,
    textAlign: "right",
    fontSize: 16,
    color: "#1B1B1B",
    fontFamily: fonts.alanSans.regular,
  },
  line: { height: 5, borderRadius: 3 },
});
