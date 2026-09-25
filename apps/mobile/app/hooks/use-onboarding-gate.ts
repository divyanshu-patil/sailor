import { useEffect } from "react";

import { userService } from "@/services/user.service";
import { useOnboardingCompletionStore } from "@/store/onboarding-completion.store";
import { useProfileSetupStore } from "@/store/profile-setup.store";

/** How long a slow profile read may hold the routing decision. Past this the
 *  local flags decide, as they would offline. */
const ANSWER_TIMEOUT_MS = 4000;

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
 *
 * It also records when the server has answered (`markChecked`), which is what
 * the router waits on before sending a signed-in user with no local completion
 * into onboarding: on a new device the server's flag is the only one that
 * knows the account already went through it.
 */
export function useOnboardingGate(userId: string | null | undefined): void {
  const completeOnboarding = useOnboardingCompletionStore(
    (s) => s.completeOnboarding,
  );
  const completeProfileSetup = useProfileSetupStore(
    (s) => s.completeProfileSetup,
  );
  const markChecked = useOnboardingCompletionStore((s) => s.markChecked);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    const settle = () => {
      if (!cancelled) markChecked(userId);
    };
    // A read that hangs must not hold the app on the splash.
    const timer = setTimeout(settle, ANSWER_TIMEOUT_MS);

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
      })
      .finally(() => {
        clearTimeout(timer);
        settle();
      });

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [userId, completeOnboarding, completeProfileSetup, markChecked]);
}
