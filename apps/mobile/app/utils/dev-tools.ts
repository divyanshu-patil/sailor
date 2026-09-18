// utils/dev-tools.ts
import { useAppUserStore } from "@/store/app-user.store";
import { useOnboardingStore } from "@/store/onboarding.store";

/**
 * Wipes all persisted app storage (auth store + any other MMKV-backed
 * zustand stores) and resets in-memory state to defaults.
 * Intended for dev/debug use only.
 */
export async function clearAppStorage() {
  try {
    // Clears the persisted MMKV entries for both stores.
    await useAppUserStore.persist.clearStorage();
    await useOnboardingStore.persist.clearStorage();

    // Reset in-memory state back to initial values.
    //
    // `hasSeenOnboarding` is NOT set here any more: onboarding moved into its
    // own store (see app-user.store's clearAppState, which deliberately leaves
    // onboarding alone), so writing it onto the app-user store set a key that
    // store no longer has. It reset nothing and was a type error.
    useAppUserStore.setState({
      appUser: null,
      _hasHydrated: true, // keep true so UI doesn't re-show a loading spinner
    });
    useOnboardingStore.getState().resetOnboarding();

    console.log("App storage cleared");
    return true;
  } catch (e) {
    console.error("Failed to clear app storage:", e);
    return false;
  }
}
