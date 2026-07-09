import React, { useEffect, useMemo } from "react";
import { View, StyleSheet, TextStyle, ViewStyle, Platform } from "react-native";
import Animated, {
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  Easing,
  EntryAnimationsValues,
} from "react-native-reanimated";

type TextMorphProps = {
  text: string;
  style?: TextStyle | TextStyle[];
  containerStyle?: ViewStyle;
};

const SPRING_CONFIG = { damping: 100 };

function morphEntering(values: EntryAnimationsValues) {
  "worklet";
  return {
    initialValues: {
      width: 0,
      opacity: 0,
      transform: [{ scale: 0.85 }, { translateX: -20 }],
      ...(Platform.OS === "ios" ? { filter: [{ blur: 6 }] } : {}),
    },
    animations: {
      width: withSpring(values.targetWidth, SPRING_CONFIG),
      opacity: withTiming(1, { duration: 220 }),
      transform: [
        { scale: withSpring(1, SPRING_CONFIG) },
        { translateX: withSpring(0, SPRING_CONFIG) },
      ],
      ...(Platform.OS === "ios"
        ? {
            filter: [
              {
                blur: withSequence(
                  withTiming(2, { duration: 100 }),
                  withTiming(0, { duration: 120 }),
                ),
              },
            ],
          }
        : {}),
    },
  };
}

function MorphChar({
  id,
  label,
  index,
  style,
}: {
  id: string;
  label: string;
  index: number;
  style?: TextStyle | TextStyle[];
}) {
  const blur = useSharedValue(0);

  useEffect(() => {
    // fires whenever THIS character's position in the string changes
    blur.value = withSequence(
      withTiming(4, { duration: 120, easing: Easing.out(Easing.ease) }),
      withTiming(0, { duration: 160, easing: Easing.in(Easing.ease) }),
    );
  }, [blur, index]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      filter: Platform.OS === "ios" ? [{ blur: blur.value }] : undefined,
    } as TextStyle;
  });

  return (
    <Animated.Text
      key={id}
      entering={morphEntering}
      exiting={FadeOut.duration(150)}
      layout={LinearTransition.springify().damping(SPRING_CONFIG.damping)}
      style={[style, animatedStyle]}
    >
      {label}
    </Animated.Text>
  );
}

export function TextMorph({ text, style, containerStyle }: TextMorphProps) {
  const characters = useMemo(() => {
    const counts: Record<string, number> = {};
    return text.split("").map((char, index) => {
      const k = char.toLowerCase();
      counts[k] = (counts[k] || 0) + 1;
      return {
        id: `${k}-${counts[k]}`,
        label: char === " " ? "\u00A0" : char,
        index,
      };
    });
  }, [text]);

  return (
    <View style={[styles.row, containerStyle]}>
      {characters.map((c) => (
        <MorphChar
          key={c.id}
          id={c.id}
          label={c.label}
          index={c.index}
          style={style}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap" },
});
