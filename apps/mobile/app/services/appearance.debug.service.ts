import { AppearanceOption } from "@/types/settings/preferences";
export * from "@/types/settings/preferences";

// --- DEV-ONLY MOCK -----------------------------------------------------
// Same shape/export name as appearance.service.ts's real apiClient call.
// Swap the import in SettingsScreen.tsx from "./appearance.debug.service"
// to "./appearance.service" once GET /api/v1/appearance/options is live.
// Delete this file at that point.
// -------------------------------------------------------------------------

const DUMMY_APPEARANCE_OPTIONS: AppearanceOption[] = [
  { id: "lavender", name: "Lavender", hex: "#8442E1" },
  { id: "ocean", name: "Ocean", hex: "#4299E1" },
  { id: "forest", name: "Forest", hex: "#42E19C" },
  { id: "sunset", name: "Sunset", hex: "#E17F42" },
  { id: "rose", name: "Rose", hex: "#E14242" },
  { id: "midnight", name: "Midnight", hex: "#CE42E1" },
];

export const appearanceService = {
  getOptions: async (): Promise<AppearanceOption[]> => {
    // const response = await apiClient.get<AppearanceOption[]>(
    //   "/api/v1/appearance/options",
    // );
    // return response.data;

    return await new Promise((resolve) => {
      setTimeout(() => {
        resolve(DUMMY_APPEARANCE_OPTIONS);
      }, 300); // simulate GET latency
    });
  },
};
