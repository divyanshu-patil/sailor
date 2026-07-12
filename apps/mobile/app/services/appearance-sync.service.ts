import {
  usePreferenceStore,
  defaultPreferences,
} from "@/store/preference-store";
import { appearanceService } from "@/services/appearance.debug.service";
import { AppearanceOption } from "@/types/settings/preferences";
import { debugService } from "@/services/debug.service";

function diffAppearanceOptions(
  local: AppearanceOption[],
  server: AppearanceOption[],
) {
  const localIds = new Set(local.map((o) => o.id));
  const serverIds = new Set(server.map((o) => o.id));
  return {
    added: server.filter((o) => !localIds.has(o.id)),
    removed: local.filter((o) => !serverIds.has(o.id)),
  };
}

let hasSyncedThisSession = false;

export async function syncAppearanceOptions(): Promise<void> {
  const store = usePreferenceStore.getState();
  const localOptions = store.appearanceOptions;

  try {
    const serverOptions = await appearanceService.getOptions();

    const { added, removed } = diffAppearanceOptions(
      localOptions,
      serverOptions,
    );
    if (added.length || removed.length) {
      debugService.log("appearance-sync", "Appearance options changed", {
        added: added.map((o) => o.id),
        removed: removed.map((o) => o.id),
      });
    }

    // Server is the source of truth once it responds — this naturally
    // "adds new colors" and "reduces" removed ones in one replace.
    store.setAppearanceOptions(serverOptions);

    // If the user's currently selected color got removed server-side,
    // fall back gracefully instead of leaving a dangling reference.
    const current = store.preferences.appearance;
    const stillExists = serverOptions.some((o) => o.id === current.id);
    if (!stillExists) {
      const fallback = serverOptions[0] ?? defaultPreferences.appearance;
      debugService.log(
        "appearance-sync",
        "Selected appearance no longer available",
        {
          previous: current.id,
          fallback: fallback.id,
        },
      );
      store.setPreference("appearance", fallback);
    }
  } catch (e) {
    // Offline-first: keep whatever was persisted locally, just log it.
    debugService.warn(
      "appearance-sync",
      "Failed to fetch server appearance options",
      e,
    );
  }
}

/** Call once per app session (e.g. from your root layout's effect). */
export function syncAppearanceOptionsOnce(): void {
  if (hasSyncedThisSession) return;
  hasSyncedThisSession = true;
  void syncAppearanceOptions();
}
