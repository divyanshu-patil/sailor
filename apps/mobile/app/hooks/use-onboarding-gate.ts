import { useEffect } from "react";

import { userService } from "@/services/user.service";
import { useOnboardingCompletionStore } from "@/store/onboarding-completion.store";
import { useProfileSetupStore } from "@/store/profile-setup.store";

/**
 * Whether this account has finished onboarding and the profile wizard.
 *
 * The answer is the ACCOUNT's, not the device's. Held only in MMKV, these flags
 * ran onboarding again on every fresh install and on every second device, and
 * never again after a reinstall on the first — the flow is a fact about the
 * user, so the server owns it.
 *
 * The local stores are still the ones the router reads, for two reasons: they
 * are on disk before the first frame, so there is no flash of onboarding while
 * a request is in flight, and they work with no connection. This hook only
 * reconciles them — it fetches the profile once per signed-in session and
 * writes the server's answer down locally when the server knows better.
 *
 * Reconciliation is deliberately one-way. A server that says "completed" marks
 * it locally; a server that says "not completed" is ignored, because the local
 * flag may have been set moments ago by a flow whose PATCH has not landed yet
 * (or failed offline). The flags only ever move toward done.
 */
export function useOnboardingGate(userId: string | null | undefined): void {
  const completeOnboarding = useOnboardingCompletionStore(
    (s) => s.completeOnboarding,
  );
  const completeProfileSetup = useProfileSetupStore(
    (s) => s.completeProfileSetup,
  );

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    userService
      .getProfile()
      .then((profile) => {
        if (cancelled) return;
        if (profile.onboarding_completed) completeOnboarding(userId);
        if (profile.profile_setup_completed) completeProfileSetup(userId);
      })
      .catch(() => {
        // Offline, or the profile row does not exist yet. The local flags
        // stand, which is the whole point of them being local.
      });

    return () => {
      cancelled = true;
    };
  }, [userId, completeOnboarding, completeProfileSetup]);
}
