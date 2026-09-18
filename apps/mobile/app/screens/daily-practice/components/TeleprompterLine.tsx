import React from "react";
import { LayoutChangeEvent, StyleSheet } from "react-native";
import Animated, {
  interpolate,
  interpolateColor,
  SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";

import { dailyFonts, DailyTheme } from "../theme";

interface TeleprompterLineProps {
  text: string;
  index: number;
  /** Fractional scroll position, in line units. */
  offset: SharedValue<number>;
  /** Slot pitch — the distance between two consecutive paragraphs. */
  lineHeight: number;
  /** This paragraph's measured height, 0 until it has laid out. */
  height: number;
  onMeasure: (index: number, height: number) => void;
  theme: DailyTheme;
}

/**
 * One paragraph in the teleprompter column.
 *
 * Position, size, opacity and colour are all derived from how far this
 * paragraph is from the centre, so the whole column responds continuously to
 * the drag rather than snapping between two discrete states. Everything runs in
 * a worklet on the UI thread — a gesture that hands each frame to JS to
 * recompute text styles drops frames the moment the list is more than a few
 * paragraphs long.
 *
 * Each paragraph is centred on its own slot by offsetting half its measured
 * height. They used to hang from the top of the slot, so a four-line paragraph
 * spilled below the highlight while a one-line paragraph floated above it.
 */
export function TeleprompterLine({
  text,
  index,
  offset,
  lineHeight,
  height,
  onMeasure,
  theme,
}: TeleprompterLineProps) {
  const handleLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.height;
    if (Math.abs(next - height) > 0.5) onMeasure(index, next);
  };

  const animatedStyle = useAnimatedStyle(() => {
    // 0 when this paragraph is centred, ±1 when it is one slot away.
    const distance = index - offset.value;
    const abs = Math.abs(distance);

    return {
      transform: [
        { translateY: distance * lineHeight - height / 2 },
        // Shrinks away from the centre. Clamped so a paragraph three away
        // doesn't keep collapsing toward nothing.
        { scale: interpolate(abs, [0, 1, 2.5], [1, 0.84, 0.76], "clamp") },
      ],
      opacity: interpolate(abs, [0, 1, 2.5], [1, 0.3, 0.1], "clamp"),
      color: interpolateColor(
        Math.min(abs, 1),
        [0, 1],
        [theme.inkColored, theme.inkFaint],
      ),
    };
  });

  return (
    <Animated.Text style={[styles.line, animatedStyle]} onLayout={handleLayout}>
      {text}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  line: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    fontFamily: dailyFonts.body,
    fontSize: 25,
    lineHeight: 33,
    letterSpacing: -0.4,
  },
});
