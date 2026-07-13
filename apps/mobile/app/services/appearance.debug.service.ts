import { AppearanceOption } from "@/types/settings/preferences";
export * from "@/types/settings/preferences";

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
      }, 7000); // simulate GET latency
    });
  },
};
