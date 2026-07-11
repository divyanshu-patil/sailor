import { apiClient } from "@/lib/api/client";

// ---------------------------------------------------------------------------
// User-level app preferences: appearance choice, haptics, practice reminders,
// and the default emotional mood used when generating a script.
// ---------------------------------------------------------------------------

export type ScriptMood =
  "confident" | "calm" | "playful" | "reflective" | "energetic";

export interface UserPreferences {
  appearanceId: string;
  emotionHapticsEnabled: boolean;
  practiceRemindersEnabled: boolean;
  /** 24h local time, "HH:mm" */
  practiceReminderTime: string;
  defaultMood: ScriptMood;
}

export const preferencesService = {
  getPreferences: async (): Promise<UserPreferences> => {
    try {
      const response = await apiClient.get<UserPreferences>(
        "/api/v1/users/preferences",
      );
      return response.data;
    } catch (e: any) {
      console.log(
        "preferences get error",
        e.response?.data,
        e.response?.status,
      );
      throw e;
    }
  },

  updatePreferences: async (
    payload: Partial<UserPreferences>,
  ): Promise<UserPreferences> => {
    try {
      const response = await apiClient.patch<UserPreferences>(
        "/api/v1/users/preferences",
        payload,
      );
      return response.data;
    } catch (e: any) {
      console.log(
        "preferences update error",
        e.response?.data,
        e.response?.status,
      );
      throw e;
    }
  },
};
