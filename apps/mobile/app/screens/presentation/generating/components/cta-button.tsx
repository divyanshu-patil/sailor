import { StyleSheet, Text, ViewStyle } from "react-native";
import React from "react";
import { AnimatedPressable } from "@/components/ui/animated/AnimatedComponents";
import { fonts } from "@/constants/fonts";
import {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

interface CtaButtonProps {
  onPress?: () => void;
  label?: string;
  children?: string;
  containerStyles?: ViewStyle;
}

const CtaButton = ({
  label,
  children,
  onPress,
  containerStyles,
}: CtaButtonProps) => {
  const pressed = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: withSpring(pressed.value ? 0.95 : 1, { damping: 50 }) },
    ],
    borderRadius: withSpring(pressed.value ? 20 : 36),
  }));
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => (pressed.value = 1)}
      onPressOut={() => (pressed.value = 0)}
      style={[styles.pressable, containerStyles, animatedStyle]}
    >
      <Text style={[styles.text]}>{label ?? children}</Text>
    </AnimatedPressable>
  );
};

export default CtaButton;

const styles = StyleSheet.create({
  pressable: {
    paddingVertical: 24,
    paddingHorizontal: 48,
    backgroundColor: "#313131",
  },
  text: { color: "white", fontSize: 28, fontFamily: fonts.krona },
});
