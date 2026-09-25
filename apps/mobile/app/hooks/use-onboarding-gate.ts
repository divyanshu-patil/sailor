import { useEffect } from "react";
import { useAuth } from "@clerk/expo";

import { userService } from "@/services/user.service";
import { useOnboardingCompletionStore } from "@/store/onboarding-completion.store";

/** How long a slow profile read may hold the routing decision. Past this the
 *  local flags decide, as they would offline. */
const ANSWER_TIMEOUT_MS = 4000;

/**
 * Whether this account has finished onboarding.
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
  const markChecked = useOnboardingCompletionStore((s) => s.markChecked);
  // Only a session Clerk has actually loaded can put a token on the request.
  // The router may already be acting on the session remembered on disk, and a
  // profile read made then went out anonymously, got a 401, and sent an
  // account that had finished onboarding straight back into it.
  const { isLoaded, isSignedIn } = useAuth();
  const canAsk = isLoaded && !!isSignedIn;

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    const settle = () => {
      if (!cancelled) markChecked(userId);
    };
    // A read that hangs, or a Clerk that never loads (offline), must not hold
    // the app on the splash.
    const timer = setTimeout(settle, ANSWER_TIMEOUT_MS);
    const stop = () => {
      cancelled = true;
      clearTimeout(timer);
    };
    if (!canAsk) return stop;

    userService
      .getProfile()
      .then((profile) => {
        if (cancelled) return;
        if (profile.onboarding_completed) completeOnboarding(userId);
      })
      .catch(() => {
        // Offline, or the profile row does not exist yet. The local flags
        // stand, which is the whole point of them being local.
      })
      .finally(() => {
        clearTimeout(timer);
        settle();
      });

    return stop;
  }, [userId, canAsk, completeOnboarding, markChecked]);
}
