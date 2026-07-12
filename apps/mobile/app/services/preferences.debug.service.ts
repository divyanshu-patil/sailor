// preferences-service.ts
import { usePreferenceStore } from "@/store/preference-store";
import { UserPreferences } from "@/types/settings/preferences";
export * from "@/types/settings/preferences";

export const preferencesService = {
  getPreferences: async (): Promise<UserPreferences> => {
    return await new Promise((resolve) => {
      setTimeout(() => {
        // read straight from the zustand/MMKV-backed store —
        // no separate in-memory default to drift out of sync
        resolve({ ...usePreferenceStore.getState().preferences });
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

        // write back through the store's own setter so persist +
        // any subscribers stay consistent, rather than mutating state directly
        usePreferenceStore.getState().setPreferences(updated);

        resolve({ ...updated });
      }, 300);
    });
  },
};
