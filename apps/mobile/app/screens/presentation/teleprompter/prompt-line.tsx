import { memo } from "react";
import { LayoutChangeEvent, StyleSheet, Text } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";

import { fonts } from "@/constants/fonts";
import { TELEPROMPTER as T } from "./config";
import type { PromptLine } from "./lines";

interface PromptLineViewProps {
  line: PromptLine;
  /** Where the scroll actually is. Written by the autoscroll loop and by the
   *  user's own drags — the same number either way. */
  offset: SharedValue<number>;
  /** Distance from the top of the viewport to the line being read. */
  focusY: SharedValue<number>;
  color: string;
  /** Bold stress and note text, in the deck's accent. */
  accent: string;
}

/**
 * One line of the prompt.
 *
 * Each line measures itself and dims by its own distance from the focus point,
 * so there is no "current index" to keep in step with the scroll — nothing is
 * recomputed on the JS thread while the text is moving, and a line is lit
 * because of where it is rather than because a state update said so.
 */
const PromptLineView = memo(function PromptLineView({
  line,
  offset,
  focusY,
  color,
  accent,
}: PromptLineViewProps) {
  const top = useSharedValue(0);
  const height = useSharedValue(0);

  const onLayout = (event: LayoutChangeEvent) => {
    top.value = event.nativeEvent.layout.y;
    height.value = event.nativeEvent.layout.height;
  };

  const animatedStyle = useAnimatedStyle(() => {
    // Distance to the line's BOX, not to its middle. A long sentence wraps to
    // six lines on a phone, and measuring from its centre left the sentence
    // being read at half opacity while its own first and last rows were the
    // part the reader needed. Inside the box the distance is zero, so the
    // whole sentence is lit for as long as the mark is anywhere in it.
    const start = top.value;
    const end = top.value + height.value;
    const mark = offset.value + focusY.value;
    const distance = mark < start ? start - mark : mark > end ? mark - end : 0;
    return {
      opacity: interpolate(
        distance,
        [0, T.falloff],
        [1, T.dimOpacity],
        Extrapolation.CLAMP,
      ),
    };
  });

  const gap = line.startsBlock
    ? line.kind === "note"
      ? T.noteGap
      : T.paragraphGap
    : T.lineGap;

  const size =
    line.kind === "note"
      ? T.noteFontSize
      : line.kind === "aside"
        ? T.asideFontSize
        : T.fontSize;

  return (
    <Animated.View style={[{ marginTop: gap }, animatedStyle]} onLayout={onLayout}>
      <Text
        style={[
          styles.line,
          {
            fontSize: size,
            lineHeight: size * T.lineHeightMultiplier,
            color: line.kind === "line" ? color : accent,
          },
          line.kind === "note" && styles.note,
          line.kind === "aside" && styles.aside,
        ]}
      >
        {line.kind === "note"
          ? line.text
          : line.segments.map((segment, i) => (
              <Text
                key={i}
                style={[
                  // Stress carries the accent, which is what the reader's eye
                  // lands on first — the same treatment the script screen
                  // gives bold text, at prompt size.
                  segment.bold && { fontFamily: fonts.newsreader.semiBold, color: accent },
                  segment.italic && styles.italic,
                ]}
              >
                {segment.text}
              </Text>
            ))}
      </Text>
    </Animated.View>
  );
});

export default PromptLineView;

const styles = StyleSheet.create({
  line: {
    fontFamily: fonts.newsreader.regular,
    textAlign: "center",
  },
  note: {
    fontFamily: fonts.alanSans.semiBold,
    letterSpacing: 0.4,
  },
  aside: {
    fontFamily: fonts.newsreader.italic,
  },
  italic: {
    fontFamily: fonts.newsreader.italic,
  },
});
