import { apiClient } from "@/lib/api/client";
import { AppearanceOption } from "@/types/settings/preferences";
export * from "@/types/settings/preferences";

// ---------------------------------------------------------------------------
// Predefined appearance/accent-color options. The backend owns this list so
// new colors can ship without an app update — the client just renders
// whatever comes back.
// ---------------------------------------------------------------------------

export const appearanceService = {
  getOptions: async (): Promise<AppearanceOption[]> => {
    try {
      const response = await apiClient.get<AppearanceOption[]>(
        "/api/v1/appearance/options",
      );
      return response.data;
    } catch (e: any) {
      console.log(
        "appearance options error",
        e.response?.data,
        e.response?.status,
      );
      throw e;
    }
  },
};
