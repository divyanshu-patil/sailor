import { apiClient } from "@/lib/api/client";
import { EditablePreferences } from "@/types/settings/preferences";
export * from "@/types/settings/preferences";

// ---------------------------------------------------------------------------
// User-level app preferences: appearance choice, haptics, practice reminders,
// and the default emotional mood used when generating a script.
// ---------------------------------------------------------------------------

export const preferencesService = {
  getPreferences: async (): Promise<EditablePreferences> => {
    try {
      const response = await apiClient.get<EditablePreferences>(
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

  createPreferences: async (
    payload: EditablePreferences,
  ): Promise<EditablePreferences> => {
    try {
      const response = await apiClient.post<EditablePreferences>(
        "/api/v1/users/preferences",
        payload,
      );
      return response.data;
    } catch (e: any) {
      console.log(
        "preferences create error",
        e.response?.data,
        e.response?.status,
      );
      throw e;
    }
  },

  updatePreferences: async (
    payload: Partial<EditablePreferences>,
  ): Promise<EditablePreferences> => {
    try {
      const response = await apiClient.patch<EditablePreferences>(
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
