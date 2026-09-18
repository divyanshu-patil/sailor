import { usePreferenceStore } from "@/store/preference-store";
import { preferencesService } from "@/services/preferences.service";
import { debugService } from "@/services/debug.service";

export async function syncPreferences(): Promise<void> {
  const store = usePreferenceStore.getState();

  try {
    const serverPreferences = await preferencesService.getPreferences();

    // Update store with server preferences (merged with local-only preferences)
    store.setPreferences({
      ...serverPreferences,
      appearance: store.preferences.appearance,
      emotionHapticsEnabled: store.preferences.emotionHapticsEnabled,
      streakWidgetColor: store.preferences.streakWidgetColor,
    });

    debugService.log("preferences-sync", "Synced preferences from server", serverPreferences);
  } catch (e) {
    debugService.warn("preferences-sync", "Failed to fetch server preferences", e);
  }
}

/** Call on app startup and after cache clear */
export function syncPreferencesOnce(): void {
  void syncPreferences();
}