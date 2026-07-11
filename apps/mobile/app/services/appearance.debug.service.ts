import { AppearanceOption } from "./appearance.service";

// --- DEV-ONLY MOCK -----------------------------------------------------
// Same shape/export name as appearance.service.ts's real apiClient call.
// Swap the import in SettingsScreen.tsx from "./appearance.debug.service"
// to "./appearance.service" once GET /api/v1/appearance/options is live.
// Delete this file at that point.
// -------------------------------------------------------------------------

const DUMMY_APPEARANCE_OPTIONS: AppearanceOption[] = [
  { id: "lavender", name: "Lavender", hex: "#6C5CE7" },
  { id: "coral", name: "Coral", hex: "#F95738" },
  { id: "sunflower", name: "Sunflower", hex: "#F4D35E" },
  { id: "sky", name: "Sky", hex: "#5FA8D3" },
  { id: "forest", name: "Forest", hex: "#0D3B66" },
  { id: "tangerine", name: "Tangerine", hex: "#EE964B" },
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
