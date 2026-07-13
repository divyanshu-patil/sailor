import React from "react";
import { StyleSheet, Text } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import PressableScale from "@/components/ui/animated/PressableScale";

interface LogoutButtonProps {
  onPress: () => void;
}

/**
 * The logout row, including its own squish/fade press animation.
 * Takes a single onPress so the confirmation + sign-out logic
 * (useLogout) stays completely decoupled from the animation.
 */
const LogoutButton = ({ onPress }: LogoutButtonProps) => {
  return (
    <PressableScale
      style={[styles.logoutContainer]}
      onPress={onPress}
      opacity={{
        pressedOpacity: 0.5,
      }}
    >
      <Ionicons name="exit-outline" size={28} color="#E44141" />
      <Text style={styles.logoutText}>Logout</Text>
    </PressableScale>
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
