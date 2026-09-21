import React, { useEffect, useMemo } from "react";
import { Text, View, TextStyle, StyleProp, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSpring,
  Easing,
  WithSpringConfig,
  WithTimingConfig,
} from "react-native-reanimated";

interface FadeInDownTextProps {
  textStyle?: StyleProp<TextStyle>;
  children: string;

  /** ms each character takes to animate in. Default 450. */
  duration?: number;
  /** ms gap between each character's start. Default 30. */
  staggerDelay?: number;
  /** ms before the very first character starts. Default 0. */
  initialDelay?: number;
  /** px the character travels upward while fading in. Default 10. */
  distance?: number;
  /**
   * Pass a spring config to animate with a spring instead of a timing curve.
   * If omitted, a timing animation (with `easing`) is used.
   */
  springConfig?: WithSpringConfig;
  /** Easing used when NOT using a spring. Default Easing.out(Easing.cubic). */
  easing?: (value: number) => number;
  /** Stagger unit — animate delay increments per character (default) or per word. */
  staggerUnit?: "char" | "word";
}

function AnimatedChar({
  char,
  delay,
  duration,
  distance,
  springConfig,
  easing,
  style,
}: {
  char: string;
  delay: number;
  duration: number;
  distance: number;
  springConfig?: WithSpringConfig;
  easing: (value: number) => number;
  style?: StyleProp<TextStyle>;
}) {
  const progress = useSharedValue(0);
  const translateY = useSharedValue(distance);

  useEffect(() => {
    const timingConfig: WithTimingConfig = { duration, easing };
    progress.value = withDelay(
      delay,
      springConfig ? withSpring(1, springConfig) : withTiming(1, timingConfig),
    );
    translateY.value = withDelay(
      delay,
      springConfig ? withSpring(0, springConfig) : withTiming(0, timingConfig),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // This now applies to a real Animated.View, so translateY works.
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Text style={style}>{char}</Text>
    </Animated.View>
  );
}

export default function FadeInDownText({
  textStyle,
  children,
  duration = 450,
  staggerDelay = 30,
  initialDelay = 0,
  distance = 10,
  springConfig,
  easing = Easing.out(Easing.cubic),
  staggerUnit = "char",
}: FadeInDownTextProps) {
  const words = useMemo(() => children.split(" "), [children]);

  // Precompute every unit index (per-char or per-word) up front, as a pure
  // derivation of `words` + `staggerUnit`. No mutation happens during render —
  // this whole structure is built once per dependency change via useMemo,
  // and the render below just reads from it.
  const layout = useMemo(() => {
    let counter = 0;
    return words.map((word, wIndex) => {
      const chars = word.split("");
      const charUnitIndices = chars.map((_, cIndex) => {
        const unitIndex = staggerUnit === "word" ? wIndex : counter;
        counter++;
        return unitIndex;
      });

      const isLastWord = wIndex === words.length - 1;
      let spaceUnitIndex: number | null = null;
      if (!isLastWord) {
        spaceUnitIndex = staggerUnit === "word" ? wIndex : counter;
        counter++;
      }

      return { word, chars, charUnitIndices, spaceUnitIndex, isLastWord };
    });
  }, [words, staggerUnit]);

  return (
    <View style={styles.line}>
      {layout.map(
        ({ chars, charUnitIndices, spaceUnitIndex, isLastWord }, wIndex) => {
          const charNodes = chars.map((char, cIndex) => (
            <AnimatedChar
              key={`char-${wIndex}-${cIndex}`}
              char={char}
              delay={initialDelay + charUnitIndices[cIndex] * staggerDelay}
              duration={duration}
              distance={distance}
              springConfig={springConfig}
              easing={easing}
              style={textStyle}
            />
          ));

          if (!isLastWord && spaceUnitIndex !== null) {
            return (
              <React.Fragment key={`word-${wIndex}`}>
                {/* non-wrapping row: this word can never split across lines */}
                <View style={styles.word}>{charNodes}</View>
                <AnimatedChar
                  char=" "
                  delay={initialDelay + spaceUnitIndex * staggerDelay}
                  duration={duration}
                  distance={distance}
                  springConfig={springConfig}
                  easing={easing}
                  style={textStyle}
                />
              </React.Fragment>
            );
          }

          return (
            <View key={`word-${wIndex}`} style={styles.word}>
              {charNodes}
            </View>
          );
        },
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    flexDirection: "row",
    // No wrapping. Each character is its own view here, so words are held
    // together by the `word` rows below but the gaps between them are real
    // flex boundaries — with `wrap` on, a two-word label like "Try again"
    // breaks across two lines as soon as the measured width is tight, which
    // is what it did inside the generation overlay's CTA. The only consumer
    // is a short button label, so a single line is always what is wanted;
    // the pressable already clips (`overflow: "hidden"`) if one ever is too
    // long, which is a better failure than a two-line pill.
    flexWrap: "nowrap",
    alignItems: "flex-end",
  },
  word: {
    flexDirection: "row",
  },
});
