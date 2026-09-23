import { useAuth } from "@clerk/expo";

import { PENDING_SCOPE } from "@/types/onboarding";
import { useOnboardingController } from "./use-onboarding-controller";

/**
 * The controller for whichever scope the flow is running in.
 *
 * Every step route builds its own controller off the same store, so the
 * position and answers stay shared across the stack while each screen owns its
 * own rendering concerns.
 */
export function useOnboardingScope() {
  const { userId } = useAuth();
  const authenticated = !!userId;
  const scope = userId ?? PENDING_SCOPE;
  const controller = useOnboardingController(scope, authenticated);
  return { controller, authenticated };
}
