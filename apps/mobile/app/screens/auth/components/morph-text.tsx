import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import { fonts } from "@/constants/fonts";

const INK = "#1C1A18";
const YELLOW = "#F4CF66";
const NOTE = "#9C968F";

/**
 * Cross-layer text morph. Two absolutely-stacked layers share the same font
 * metrics and are driven by the same `progress` value over shifted ranges, so
 * the old copy translates/scales/fades out exactly as the new copy eases in —
 * a physical hand-off rather than a hard swap.
 */
export interface MorphHeadlineProps {
  progress: SharedValue<number>;
  baseLine1: string;
  baseLine2: string;
  /** Opacity of the rotating onboarding headline (1 once the morph starts). */
  rotationOpacity: SharedValue<number>;
  /**
   * Extra downward offset (device points) the create-account headline settles
   * at. Use it to slide the final headline into the empty space below.
   */
  createOffsetY?: number;
  style?: StyleProp<ViewStyle>;
}

export function MorphHeadline({
  progress,
  baseLine1,
  baseLine2,
  rotationOpacity,
  createOffsetY = 0,
  style,
}: MorphHeadlineProps) {
  const baseStyle = useAnimatedStyle(() => {
    const p = progress.value;
    // While the morph is running the rotating headline is forced fully opaque
    // so it always fades out from a visible state, whatever the rotation was
    // mid-fade when the CTA was pressed.
    const rotation = p > 0 ? 1 : rotationOpacity.value;
    const out = interpolate(p, [0.15, 0.5], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: rotation * (1 - out),
      transform: [
        { translateY: interpolate(out, [0, 1], [0, -30]) },
        { scale: interpolate(out, [0, 1], [1, 0.92]) },
      ],
    };
  });

  const createStyle = useAnimatedStyle(() => {
    const inn = interpolate(
      progress.value,
      [0.42, 0.85],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return {
      opacity: inn,
      transform: [
        {
          translateY: interpolate(
            inn,
            [0, 1],
            [34 + createOffsetY, createOffsetY],
          ),
        },
        { scale: interpolate(inn, [0, 1], [0.9, 1]) },
      ],
    };
  });

  return (
    <View pointerEvents="none" style={[styles.wrap, style]}>
      <Animated.View style={[styles.layer, baseStyle]}>
        <Text style={styles.mainHeadline}>{baseLine1}</Text>
        <View style={styles.underlineWrap}>
          <View style={styles.underline} />
        </View>
        <Text style={styles.secondaryHeadline}>{baseLine2}</Text>
      </Animated.View>

      <Animated.View style={[styles.layer, createStyle]}>
        <Text style={styles.mainHeadline}>Create an</Text>
        <Text style={styles.createSecondLine}>Account</Text>
      </Animated.View>
    </View>
  );
}

export interface MorphDescriptionProps {
  progress: SharedValue<number>;
  baseText: string;
  /** Extra downward offset (device points) for the create-account subtext. */
  createOffsetY?: number;
  style?: StyleProp<ViewStyle>;
}

export function MorphDescription({
  progress,
  baseText,
  createOffsetY = 0,
  style,
}: MorphDescriptionProps) {
  const baseStyle = useAnimatedStyle(() => {
    const out = interpolate(
      progress.value,
      [0.2, 0.55],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return {
      opacity: 1 - out,
      transform: [{ translateY: interpolate(out, [0, 1], [0, -18]) }],
    };
  });

  const createStyle = useAnimatedStyle(() => {
    const inn = interpolate(
      progress.value,
      [0.4, 0.8],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return {
      opacity: inn,
      transform: [
        {
          translateY: interpolate(
            inn,
            [0, 1],
            [18 + createOffsetY, createOffsetY],
          ),
        },
      ],
    };
  });

  return (
    <View pointerEvents="none" style={[styles.wrap, style]}>
      <Animated.View style={[styles.layer, baseStyle]}>
        <Text style={styles.description}>{baseText}</Text>
      </Animated.View>
      <Animated.View style={[styles.layer, createStyle]}>
        <Text style={styles.description}>
          {"Join us and start creating, practicing\nand presenting with confidence."}
        </Text>
      </Animated.View>
    </View>
  );
}

export interface MorphNoteProps {
  progress: SharedValue<number>;
  baseText: string;
  targetText: string;
  from: { left: number; top: number };
  to: { left: number; top: number };
  baseRotation: number;
  targetRotation: number;
  width: number;
  inputRange?: [number, number];
}

/**
 * A handwritten note that physically moves, rotates and swaps its copy as the
 * screen morphs. Positions are in device points (already multiplied by the
 * screen scale by the caller).
 */
export function MorphNote({
  progress,
  baseText,
  targetText,
  from,
  to,
  baseRotation,
  targetRotation,
  width,
  inputRange = [0.2, 0.78],
}: MorphNoteProps) {
  const containerStyle = useAnimatedStyle(() => {
    const p = interpolate(
      progress.value,
      inputRange,
      [0, 1],
      Extrapolation.CLAMP,
    );
    return {
      transform: [
        { translateX: (to.left - from.left) * p },
        { translateY: (to.top - from.top) * p },
        { rotate: `${baseRotation + (targetRotation - baseRotation) * p}deg` },
      ],
    };
  });

  const baseTextStyle = useAnimatedStyle(() => {
    const p = interpolate(
      progress.value,
      [inputRange[0] + 0.08, inputRange[1] - 0.08],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return { opacity: 1 - p };
  });

  const targetTextStyle = useAnimatedStyle(() => {
    const p = interpolate(
      progress.value,
      [inputRange[0] + 0.08, inputRange[1] - 0.08],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return { opacity: p };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          left: from.left,
          top: from.top,
          width,
        },
        containerStyle,
      ]}
    >
      <Animated.Text style={[styles.noteText, baseTextStyle]}>
        {baseText}
      </Animated.Text>
      <Animated.Text style={[styles.noteText, styles.noteOverlay, targetTextStyle]}>
        {targetText}
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
  },
  layer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    alignItems: "center",
  },
  mainHeadline: {
    color: INK,
    fontFamily: fonts.alanSans.bold,
    fontSize: 46,
    lineHeight: 50,
    letterSpacing: -1.5,
    textAlign: "center",
  },
  createSecondLine: {
    color: INK,
    fontFamily: fonts.alanSans.bold,
    fontSize: 46,
    lineHeight: 50,
    letterSpacing: -1.5,
    textAlign: "center",
    marginTop: -4,
  },
  underlineWrap: {
    marginTop: -8,
    width: 210,
    height: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  underline: {
    width: 190,
    height: 8,
    borderRadius: 99,
    backgroundColor: YELLOW,
    transform: [{ rotate: "-1.4deg" }],
    opacity: 0.85,
  },
  secondaryHeadline: {
    color: INK,
    fontFamily: fonts.alanSans.semiBold,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.85,
    textAlign: "center",
    marginTop: -2,
  },
  description: {
    color: "#4B4742",
    fontFamily: fonts.alanSans.medium,
    fontSize: 14.5,
    lineHeight: 20,
    letterSpacing: -0.05,
    textAlign: "center",
  },
  noteText: {
    color: NOTE,
    fontFamily: fonts.alanSans.medium,
    fontStyle: "italic",
    fontSize: 15,
    lineHeight: 18,
    letterSpacing: 0.2,
  },
  noteOverlay: {
    position: "absolute",
    left: 0,
    top: 0,
  },
});
