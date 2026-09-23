import { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";

import { PROFILE } from "@/screens/profile/theme";
import { useOnboardingScope } from "@/screens/onboarding/hooks/use-onboarding-scope";
import ProfileIdentityStep from "@/screens/onboarding/steps/profile-identity";

/**
 * Step 1 — the nickname, and the onboarding stack's root.
 *
 * It is the group's `index` route on purpose: whatever the persisted position,
 * entering onboarding always starts the stack here, so the normal back gesture
 * walks all the way back to the first screen. Later steps are pushed on top.
 * Answers are kept in the store, so a resumed run shows them prefilled.
 */
export default function NicknameRoute() {
  const { controller, authenticated } = useOnboardingScope();
  const { setCurrentStep } = controller;

  useFocusEffect(
    useCallback(() => {
      setCurrentStep("profile_identity");
    }, [setCurrentStep]),
  );

  if (!controller.hydrated || !controller.state) {
    return <View style={styles.placeholder} />;
  }

  return (
    <ProfileIdentityStep controller={controller} authenticated={authenticated} />
  );
}

const styles = StyleSheet.create({
  placeholder: { flex: 1, backgroundColor: PROFILE.background },
});
