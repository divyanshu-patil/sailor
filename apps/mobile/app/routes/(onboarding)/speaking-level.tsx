import { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";

import { PROFILE } from "@/screens/profile/theme";
import { useOnboardingScope } from "@/screens/onboarding/hooks/use-onboarding-scope";
import SpeakingLevelStep from "@/screens/onboarding/steps/speaking-level";

export default function SpeakingLevelRoute() {
  const { controller, authenticated } = useOnboardingScope();
  const { setCurrentStep } = controller;

  useFocusEffect(
    useCallback(() => {
      setCurrentStep("speaking_level");
    }, [setCurrentStep]),
  );

  if (!controller.hydrated || !controller.state) {
    return <View style={styles.placeholder} />;
  }

  return (
    <SpeakingLevelStep controller={controller} authenticated={authenticated} />
  );
}

const styles = StyleSheet.create({
  placeholder: { flex: 1, backgroundColor: PROFILE.background },
});
