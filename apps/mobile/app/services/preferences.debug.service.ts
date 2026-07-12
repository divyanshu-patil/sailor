import { UserPreferences } from "@/types/settings/preferences";
export * from "@/types/settings/preferences";
// --- DEV-ONLY MOCK STATE -------------------------------------------------
// In-memory stand-in for GET/PATCH /api/v1/users/preferences. Same shape
// and export name as preferences.service.ts. Swap the import in
// SettingsScreen.tsx from "./preferences.debug.service" to
// "./preferences.service" once the real endpoints are ready, then delete
// this file.
// ---------------------------------------------------------------------------

let DEV_PREFERENCES: UserPreferences = {
  appearanceId: "lavender",
  emotionHapticsEnabled: true,
  practiceRemindersEnabled: true,
  practiceReminderTime: "18:00",
  defaultMood: "confident",
};

export const preferencesService = {
  getPreferences: async (): Promise<UserPreferences> => {
    // const response = await apiClient.get<UserPreferences>(
    //   "/api/v1/users/preferences",
    // );
    // return response.data;

    return await new Promise((resolve) => {
      setTimeout(() => {
        resolve({ ...DEV_PREFERENCES });
      }, 300); // simulate GET latency
    });
  },

  updatePreferences: async (
    payload: Partial<UserPreferences>,
  ): Promise<UserPreferences> => {
    // const response = await apiClient.patch<UserPreferences>(
    //   "/api/v1/users/preferences",
    //   payload,
    // );
    // return response.data;

    return await new Promise((resolve) => {
      setTimeout(() => {
        DEV_PREFERENCES = { ...DEV_PREFERENCES, ...payload };
        resolve({ ...DEV_PREFERENCES });
      }, 300); // simulate PATCH latency
    });
  },
};
