import { useAuth } from "@clerk/expo";
import { StyleSheet, View } from "react-native";

import { PROFILE } from "@/screens/profile/theme";
import { PENDING_SCOPE } from "@/types/onboarding";
import { useOnboardingController } from "./hooks/use-onboarding-controller";
import ProfileIdentityStep from "./steps/profile-identity";

/**
 * The onboarding flow — one flow, rendered by the single `(onboarding)` route.
 *
 * It runs before sign-up (the first run) and, if an account is signed in but
 * hasn't finished onboarding (e.g. signed in on a new device), it runs there
 * too. Which mode it is follows from whether there is a session, not from a
 * second route.
 *
 * One route rather than one per step: resume is then just "render whatever
 * `currentStepId` says", and there is no navigation stack to get out of step
 * with the persisted position. The route is a projection of the store.
 */
export default function OnboardingFlow() {
  const { userId } = useAuth();
  const authenticated = !!userId;
  const scope = userId ?? PENDING_SCOPE;
  const controller = useOnboardingController(scope, authenticated);

  // The local read is synchronous, but it happens in an effect, so there is one
  // frame before it lands. A cream field rather than `null` so that frame is
  // not a flash of white; never a fake interactive step.
  if (!controller.hydrated || !controller.state) {
    return <View style={styles.placeholder} />;
  }
  // Finished (or about to be handed off): the step that completed it owns the
  // navigation from here, and the root guard unmounts this on the auth side.
  if (controller.status === "completed" || !controller.currentStepId) {
    return <View style={styles.placeholder} />;
  }

  switch (controller.currentStepId) {
    case "profile_identity":
    default:
      return (
        <ProfileIdentityStep
          controller={controller}
          authenticated={authenticated}
        />
      );
  }
}

const styles = StyleSheet.create({
  placeholder: { flex: 1, backgroundColor: PROFILE.background },
});
