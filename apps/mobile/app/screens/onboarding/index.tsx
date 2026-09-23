import { Redirect } from "expo-router";
import { StyleSheet, View } from "react-native";

import { PROFILE } from "@/screens/profile/theme";
import { FIRST_STEP_ID } from "./config/steps";
import { stepRoute } from "./config/routes";
import { useOnboardingScope } from "./hooks/use-onboarding-scope";

/**
 * The onboarding entry point.
 *
 * The flow itself is a stack of step routes (`nickname`, `gender`, …). This
 * route only decides where to send the user on entry: the step the persisted
 * position says, or the first one. A completed pre-auth flow has a `null`
 * position, so it resolves to the first step and the stack rebuilds from there
 * as the user moves forward — going back then walks the steps in reverse.
 */
export default function OnboardingEntry() {
  const { controller } = useOnboardingScope();

  if (!controller.hydrated || !controller.state) {
    return <View style={styles.placeholder} />;
  }

  return <Redirect href={stepRoute(controller.currentStepId ?? FIRST_STEP_ID)} />;
}

const styles = StyleSheet.create({
  placeholder: { flex: 1, backgroundColor: PROFILE.background },
});
