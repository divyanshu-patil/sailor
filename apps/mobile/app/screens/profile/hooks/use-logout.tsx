import { Alert } from "react-native";
import { useClerk } from "@clerk/expo";
import { useAppUserStore } from "@/store/app-user.store";
import { useDailyStore } from "@/store/daily-store";
import { useOnboardingCompletionStore } from "@/store/onboarding-completion.store";
import { useOnboardingPendingStore } from "@/store/onboarding-pending.store";
import { useOnboardingProgressStore } from "@/store/onboarding-progress.store";
import { usePreferenceStore } from "@/store/preference-store";
import { useProIntroStore } from "@/store/pro-intro.store";
import { useProfileSetupStore } from "@/store/profile-setup.store";
import { useScriptStore } from "@/store/script-store";

import { haptics } from "@/lib/haptics";

/**
 * Everything this device remembers about the account, dropped. The server owns
 * all of it, so the next sign-in — this account or another — reads it back
 * rather than inheriting the last one's streak, preferences or flags.
 */
function clearAccountState() {
  useAppUserStore.getState().clearAppState();
  useDailyStore.getState().reset();
  usePreferenceStore.getState().resetPreferences();
  useOnboardingCompletionStore.getState().resetOnboardingCompletion();
  useProfileSetupStore.getState().resetProfileSetup();
  useOnboardingPendingStore.getState().reset();
  useOnboardingProgressStore.getState().clearAll();
  useScriptStore.getState().reset();
  useProIntroStore.getState().consume();
}

/**
 * Encapsulates the "are you sure?" confirmation dialog plus the actual
 * sign-out side effects (clearing local app state + Clerk sign out).
 */
export function useLogout() {
  const { signOut } = useClerk();

  const performLogout = async () => {
    try {
      // Signed out first: cleared while still signed in, the router would read
      // "onboarding not done" and flash the flow before the session ended.
      await signOut();
      clearAccountState();
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
