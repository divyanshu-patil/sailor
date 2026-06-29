/* eslint-disable react-hooks/immutability */
import { Pressable, StyleSheet, Text, View } from "react-native";
import React from "react";
import {
  createAnimatedComponent,
  interpolateColor,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { colord } from "colord";

const AnimatedPressable = createAnimatedComponent(Pressable);

interface RecordButtonProps {
  onPress?: () => void;
  accentColor: string;
}

const RecordButton = ({ onPress, accentColor }: RecordButtonProps) => {
  const buttonHighlightColor = colord(accentColor).lighten(0.025).toHex();

  const pressed = useSharedValue(false);
  const colorProgress = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: withSpring(pressed.value ? 0.95 : 1, {
          damping: 50,
        }),
      },
    ],
    backgroundColor: interpolateColor(
      colorProgress.value,
      [0, 1],
      [accentColor, buttonHighlightColor],
    ),
  }));
  return (
    <AnimatedPressable
      style={[styles.ctaPill, animatedStyle]}
      layout={LinearTransition.springify()}
      onPress={onPress}
      onPressIn={() => {
        pressed.value = true; // instant -> spring starts immediately
        colorProgress.value = withTiming(1, { duration: 300 }); // smooth color
      }}
      onPressOut={() => {
        pressed.value = false;
        colorProgress.value = withTiming(0, { duration: 150 });
      }}
    >
      <Text style={[styles.ctaText]}>Tap to Record</Text>
    </AnimatedPressable>
  );
};

export default RecordButton;

const styles = StyleSheet.create({
  ctaPill: {
    backgroundColor: "#7B75E0",
    borderRadius: 50,
    paddingVertical: 18,
    alignItems: "center",
  },
  ctaText: {
    color: "white",
    fontSize: 17,
    fontFamily: "KronaOne",
  },
});
