import React from "react";
import { StyleSheet, Text } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { AnimatedPressable } from "@/components/ui/animated/AnimatedComponents";

interface LogoutButtonProps {
  onPress: () => void;
}

/**
 * The logout row, including its own squish/fade press animation.
 * Takes a single onPress so the confirmation + sign-out logic
 * (useLogout) stays completely decoupled from the animation.
 */
const LogoutButton = ({ onPress }: LogoutButtonProps) => {
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: withSpring(pressed.value ? 0.97 : 1, { damping: 50 }) },
    ],
    opacity: withTiming(pressed.value ? 0.5 : 1),
  }));

  return (
    <AnimatedPressable
      style={[styles.logoutContainer, animatedStyle]}
      onPress={onPress}
      onPressIn={() => (pressed.value = 1)}
      onPressOut={() => (pressed.value = 0)}
    >
      <Ionicons name="exit-outline" size={28} color="#E44141" />
      <Text style={styles.logoutText}>Logout</Text>
    </AnimatedPressable>
  );
};

export default LogoutButton;

const styles = StyleSheet.create({
  logoutContainer: {
    marginTop: 8,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    gap: 12,
  },
  logoutText: {
    fontSize: 17,
    color: "#E44141",
  },
});
