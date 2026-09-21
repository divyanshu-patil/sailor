import { Alert } from "react-native";
import { useClerk } from "@clerk/expo";
import { useAppUserStore } from "@/store/app-user.store";

import { haptics } from "@/lib/haptics";

/**
 * Encapsulates the "are you sure?" confirmation dialog plus the actual
 * sign-out side effects (clearing local app state + Clerk sign out).
 */
export function useLogout() {
  const { signOut } = useClerk();
  const { clearAppState } = useAppUserStore();

  const performLogout = async () => {
    try {
      clearAppState();
      await signOut();
    } catch (error) {
      console.error("Error signing out:", error);
      Alert.alert("Error", "An error occurred while signing out.");
    }
  };

  const confirmLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout of Sailors?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: () => {
          haptics.destroy();
          performLogout();
        },
      },
    ]);
  };

  return { confirmLogout };
}
