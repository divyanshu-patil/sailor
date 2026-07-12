export interface AppearanceOption {
  id: string;
  name: string;
  hex: string;
}

export interface UserPreferences {
  appearance: AppearanceOption;
  emotionHapticsEnabled: boolean;
  practiceRemindersEnabled: boolean;
  practiceReminderTime: string;
  defaultMood: ScriptMood;
}

export type ScriptMood = "confident" | "calm" | "playful" | "reflective" | "energetic";