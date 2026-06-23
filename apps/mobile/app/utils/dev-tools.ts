// utils/dev-tools.ts
import { useAppStore } from "@/store/auth-store";

/**
 * Wipes all persisted app storage (auth store + any other MMKV-backed
 * zustand stores) and resets in-memory state to defaults.
 * Intended for dev/debug use only.
 */
export async function clearAppStorage() {
  try {
    // Clears the persisted MMKV entry for this store
    await useAppStore.persist.clearStorage();

    // Reset in-memory state back to initial values
    useAppStore.setState({
      appUser: null,
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
