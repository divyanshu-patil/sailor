import { UserPreferences, AppearanceOption } from "@/types/settings/preferences";
export * from "@/types/settings/preferences";

let DEV_PREFERENCES: UserPreferences = {
  appearance: { id: "lavender", name: "Lavender", hex: "#B794F4" },
  emotionHapticsEnabled: true,
  practiceRemindersEnabled: true,
  practiceReminderTime: "18:00",
  defaultMood: "confident",
};

export const preferencesService = {
  getPreferences: async (): Promise<UserPreferences> => {
    return await new Promise((resolve) => {
      setTimeout(() => resolve({ ...DEV_PREFERENCES }), 300);
    });
  },

  updatePreferences: async (payload: Partial<UserPreferences>): Promise<UserPreferences> => {
    return await new Promise((resolve) => {
      setTimeout(() => {
        DEV_PREFERENCES = { ...DEV_PREFERENCES, ...payload };
        resolve({ ...DEV_PREFERENCES });
      }, 300);
    });
  },
};