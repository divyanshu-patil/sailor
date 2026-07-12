import { create } from "zustand";
import { persist, createJSONStorage, StateStorage } from "zustand/middleware";
import { createMMKV } from "react-native-mmkv";
import {
  UserPreferences,
  AppearanceOption,
} from "@/types/settings/preferences";

const mmkv = createMMKV({ id: "preference-storage" });

const mmkvStorage: StateStorage = {
  getItem: (name: string) => mmkv.getString(name) ?? null,
  setItem: (name: string, value: string) => mmkv.set(name, value),
  removeItem: (name: string) => mmkv.remove(name),
};

const defaultAppearance: AppearanceOption = {
  id: "ocean",
  name: "Ocean",
  hex: "#4299E1",
};

const defaultAppearanceOptions: AppearanceOption[] = [
  { id: "lavender", name: "Lavender", hex: "#8442E1" },
  { id: "ocean", name: "Ocean", hex: "#4299E1" },
  { id: "forest", name: "Forest", hex: "#42E19C" },
  { id: "sunset", name: "Sunset", hex: "#E17F42" },
  { id: "rose", name: "Rose", hex: "#E14242" },
  { id: "midnight", name: "Midnight", hex: "#CE42E1" },
];

export const defaultPreferences: UserPreferences = {
  appearance: defaultAppearance,
  emotionHapticsEnabled: true,
  practiceRemindersEnabled: true,
  practiceReminderTime: "18:00",
  defaultMood: "confident",
};

interface PreferenceStore {
  preferences: UserPreferences;
  appearanceOptions: AppearanceOption[];
  setPreferences: (preferences: UserPreferences) => void;
  setPreference: <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K],
  ) => void;
  setAppearance: (appearance: AppearanceOption) => void;
  setAppearanceOptions: (options: AppearanceOption[]) => void;
  resetPreferences: () => void;
}

export const usePreferenceStore = create<PreferenceStore>()(
  persist(
    (set) => ({
      preferences: { ...defaultPreferences },
      appearanceOptions: defaultAppearanceOptions,
      setPreferences: (preferences) => set({ preferences }),
      setPreference: (key, value) =>
        set((state) => ({
          preferences: { ...state.preferences, [key]: value },
        })),
      setAppearance: (appearance) =>
        set((state) => ({ preferences: { ...state.preferences, appearance } })),
      setAppearanceOptions: (appearanceOptions) => set({ appearanceOptions }),
      resetPreferences: () => set({ preferences: { ...defaultPreferences } }),
    }),
    {
      name: "preference-store",
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        preferences: state.preferences,
        appearanceOptions: state.appearanceOptions,
      }),
    },
  ),
);
