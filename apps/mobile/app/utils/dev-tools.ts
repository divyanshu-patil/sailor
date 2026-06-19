// utils/dev-tools.ts
import { useAuthStore } from "@/store/auth-store";

/**
 * Wipes all persisted app storage (auth store + any other MMKV-backed
 * zustand stores) and resets in-memory state to defaults.
 * Intended for dev/debug use only.
 */
export async function clearAppStorage() {
  try {
    // Clears the persisted MMKV entry for this store
    await useAuthStore.persist.clearStorage();

    // Reset in-memory state back to initial values
    useAuthStore.setState({
      user: null,
      tokens: null,
      isLoading: false,
      hasSeenOnboarding: false,
      _hasHydrated: true, // keep true so UI doesn't re-show a loading spinner
    });

    console.log("App storage cleared");
    return true;
  } catch (e) {
    console.error("Failed to clear app storage:", e);
    return false;
  }
}
