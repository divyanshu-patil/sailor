import { memo } from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { fonts } from "@/constants/fonts";
import { useFloatingValue } from "@/screens/presentation/generation/components/background/hooks/use-floating-value";

/**
 * The handwritten asides — "Ready to speak?", "Oops... Streaks break sometimes."
 *
 * Lives here rather than in the home screen because the restore flow uses the
 * same four-in-a-corner treatment, and a second copy of the doodled arrow is
 * how two screens' handwriting starts to diverge.
 */

/** A doodled arrow, drawn at a fixed aspect so `size` is its only knob. */
export const DoodleArrow = memo(function DoodleArrow({
  size,
  color,
  flip,
}: {
  size: number;
  color: string;
  flip?: boolean;
}) {
  return (
    <Svg
      width={size * (80 / 115)}
      height={size}
      viewBox="0 0 80 115"
      fill="none"
      style={flip ? { transform: [{ scaleX: -1 }] } : undefined}
    >
      <Path
        d="M 8 20 C 26 16, 44 24, 54 40 C 64 56, 64 74, 60 94 M 60 94 L 48 83 M 60 94 L 73 84"
        stroke={color}
        strokeWidth={4.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
});

export interface HandwrittenNoteProps {
  lines: string[];
  arrowSize: number;
  color: string;
  /** Overrides the 17pt default, for a note that has to carry more or less
   *  weight than the ones around it. */
  fontSize?: number;
  /** Overrides the Kalam-Light default, for a note that needs the regular
   *  weight. */
  fontFamily?: string;
  /** Mirrors the arrow and right-aligns the text, for notes on the right. */
  flip?: boolean;
  /** Position, plus an optional `transform`. Typed without the string form of
   *  `transform`, which cannot be merged into the drift below. */
  style: Omit<ViewStyle, "transform"> & {
    transform?: Exclude<ViewStyle["transform"], string | undefined>;
  };
}

/**
 * A handwritten aside that drifts.
 *
 * `useFloatingValue` is the generation screen's drifter, reused: it retimes
 * itself on every settle, so two notes started together never lock into the
 * same rhythm the way two `withRepeat` loops of equal duration would.
 */
export const HandwrittenNote = memo(function HandwrittenNote({
  lines,
  arrowSize,
  color,
  fontSize,
  fontFamily,
  flip,
  style,
}: HandwrittenNoteProps) {
  const drift = useFloatingValue(0, -5, 5, 2600, 4200, 1);

  // A `transform` in `style` would be silently dropped: the animated style is
  // last in the array below, and RN replaces the whole transform list rather
  // than merging it — so the drift's translateY wins and any rotate the caller
  // wrote never renders. Lifting it out and re-adding it inside the worklet is
  // what makes `transform: [{ rotate: "8deg" }]` at the call site work.
  const { transform: staticTransform, ...position } = style;
  const floating = useAnimatedStyle(() => ({
    transform: [{ translateY: drift.value }, ...(staticTransform ?? [])],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.note, position as ViewStyle, floating]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text
        style={[
          styles.text,
          { color },
          fontFamily !== undefined && { fontFamily },
          fontSize !== undefined && { fontSize, lineHeight: fontSize * 1.35 },
        ]}
      >
        {lines.join("\n")}
      </Text>
      <View style={flip ? styles.arrowRight : styles.arrowLeft}>
        <DoodleArrow size={arrowSize} color={color} flip={flip} />
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  note: { position: "absolute" },
  text: {
    fontFamily: fonts.kalam.light,
    fontSize: 17,
    lineHeight: 23,
    textAlign: "center",
  },
  arrowLeft: { marginTop: 2, marginLeft: 14 },
  arrowRight: { marginTop: 2, alignItems: "flex-end", marginRight: 34 },
});
