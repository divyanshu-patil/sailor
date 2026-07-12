import { usePreferenceStore } from "@/store/preference-store";
import { UserPreferences } from "@/types/settings/preferences";
import { debugService } from "@/services/debug.service";
export * from "@/types/settings/preferences";

export const preferencesService = {
  getPreferences: async (): Promise<UserPreferences> => {
    return await new Promise((resolve) => {
      setTimeout(() => {
        const prefs = { ...usePreferenceStore.getState().preferences };
        debugService.log("preferences-service", "getPreferences", prefs);
        resolve(prefs);
      }, 300);
    });
  },

  updatePreferences: async (
    payload: Partial<UserPreferences>,
  ): Promise<UserPreferences> => {
    return await new Promise((resolve) => {
      setTimeout(() => {
        const current = usePreferenceStore.getState().preferences;
        const updated = { ...current, ...payload };

        debugService.log("preferences-service", "updatePreferences", {
          payload,
          updated,
        });

        usePreferenceStore.getState().setPreferences(updated);
        resolve({ ...updated });
      }, 300);
    });
  },
};
