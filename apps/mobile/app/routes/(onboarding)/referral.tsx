import { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";

import { PROFILE } from "@/screens/profile/theme";
import { useOnboardingScope } from "@/screens/onboarding/hooks/use-onboarding-scope";
import ReferralStep from "@/screens/onboarding/steps/referral";

export default function ReferralRoute() {
  const { controller, authenticated } = useOnboardingScope();
  const { setCurrentStep } = controller;

  useFocusEffect(
    useCallback(() => {
      setCurrentStep("referral");
    }, [setCurrentStep]),
  );

  if (!controller.hydrated || !controller.state) {
    return <View style={styles.placeholder} />;
  }

  return <ReferralStep controller={controller} authenticated={authenticated} />;
}

const styles = StyleSheet.create({
  placeholder: { flex: 1, backgroundColor: PROFILE.background },
});
