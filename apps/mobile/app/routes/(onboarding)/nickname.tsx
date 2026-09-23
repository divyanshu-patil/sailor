import { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";

import { PROFILE } from "@/screens/profile/theme";
import { useOnboardingScope } from "@/screens/onboarding/hooks/use-onboarding-scope";
import ProfileIdentityStep from "@/screens/onboarding/steps/profile-identity";

export default function NicknameRoute() {
  const { controller, authenticated } = useOnboardingScope();
  const { setCurrentStep } = controller;

  // Keep the persisted position on the screen actually in view, so a back
  // gesture resumes here next launch rather than at the step ahead.
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
