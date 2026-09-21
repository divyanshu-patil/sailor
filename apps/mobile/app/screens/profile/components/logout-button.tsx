import { memo } from "react";
import { StyleSheet, Text } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";

import PressableScale from "@/components/ui/animated/PressableScale";
import { PROFILE_PASTELS, profileFonts } from "../theme";

interface LogoutButtonProps {
  onPress: () => void;
}

/**
 * The logout action, visually separated from the settings card and tinted with
 * the danger pastel. Takes a single onPress so the confirmation + sign-out
 * logic (useLogout) stays decoupled from the button.
 */
const LogoutButton = memo(function LogoutButton({
  onPress,
}: LogoutButtonProps) {
  return (
    <PressableScale
      onPress={onPress}
      style={styles.button}
      accessibilityRole="button"
      accessibilityLabel="Log out"
    >
      <Ionicons name="log-out-outline" size={26} color={styles.label.color} />
      <Text style={styles.label}>Log out</Text>
    </PressableScale>
  );
});

export default LogoutButton;

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 56,
    borderRadius: 999,
    backgroundColor: PROFILE_PASTELS.logout,
  },
  label: {
    fontFamily: profileFonts.semibold,
    fontSize: 16,
    color: "#FFDEE3",
    letterSpacing: -0.2,
  },
});
