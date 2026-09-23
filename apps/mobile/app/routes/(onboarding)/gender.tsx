import { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";

import { PROFILE } from "@/screens/profile/theme";
import { useOnboardingScope } from "@/screens/onboarding/hooks/use-onboarding-scope";
import GenderStep from "@/screens/onboarding/steps/gender";

export default function GenderRoute() {
  const { controller, authenticated } = useOnboardingScope();
  const { setCurrentStep } = controller;

  useFocusEffect(
    useCallback(() => {
      setCurrentStep("gender");
    }, [setCurrentStep]),
  );

  if (!controller.hydrated || !controller.state) {
    return <View style={styles.placeholder} />;
  }

  return <GenderStep controller={controller} authenticated={authenticated} />;
}

const styles = StyleSheet.create({
  placeholder: { flex: 1, backgroundColor: PROFILE.background },
});
