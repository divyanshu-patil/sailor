import type { Href } from "expo-router";

import type { OnboardingStepId } from "@/types/onboarding";

/**
 * Where each onboarding step lives in the router.
 *
 * The flow is a normal stack — one route per step — so the system back gesture
 * walks back through the steps the way it does anywhere else in the app,
 * instead of a single route swapping its contents. This is the only place the
 * step ids and the route names meet.
 */
const STEP_ROUTES: Record<OnboardingStepId, Href> = {
  profile_identity: "/(onboarding)/nickname" as Href,
  gender: "/(onboarding)/gender" as Href,
};

export function stepRoute(id: OnboardingStepId): Href {
  return STEP_ROUTES[id];
}
