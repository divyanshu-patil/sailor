// utils/dev-tools.ts
import { useAppUserStore } from "@/store/app-user.store";
import { useOnboardingCompletionStore } from "@/store/onboarding-completion.store";
import { useOnboardingPendingStore } from "@/store/onboarding-pending.store";
import {
  clearOnboardingProgress,
  useOnboardingProgressStore,
} from "@/store/onboarding-progress.store";
import { PENDING_SCOPE } from "@/types/onboarding";

/**
 * Wipes all persisted onboarding/profile state and resets in-memory state to
 * defaults. Intended for dev/debug use only.
 *
 * The completion and workflow stores are reset here too, not just the
 * signed-in user — otherwise "clear storage" left the account marked as having
 * finished onboarding and the flow could not be re-run without a new account.
 * The backend's one-way completion flags are deliberately NOT reset: they can
 * only move toward done, and a debug button should not be able to undo that.
 * Use a fresh test account to re-run the server-side path.
 */
export async function clearAppStorage() {
  try {
    await useAppUserStore.persist.clearStorage();
    await useOnboardingCompletionStore.persist.clearStorage();
    await useOnboardingPendingStore.persist.clearStorage();
    // Not zustand/persist stores: they key per scope and clear themselves.
    useOnboardingProgressStore.getState().clearAll();
    clearOnboardingProgress(PENDING_SCOPE);

    // Reset in-memory state back to initial values.
    useAppUserStore.setState({
      appUser: null,
      _hasHydrated: true, // keep true so UI doesn't re-show a loading spinner
    });
    useOnboardingCompletionStore.getState().resetOnboardingCompletion();
    useOnboardingPendingStore.getState().reset();

    console.log("App storage cleared");
    return true;
  } catch (e) {
    console.error("Failed to clear app storage:", e);
    return false;
  }
}
