export interface AppearanceOption {
  id: string;
  name: string;
  hex: string;
}

export interface EditablePreferences {
  practiceRemindersEnabled: boolean;
  practiceReminderTime: string;
  defaultMood: ScriptMood;
}
export interface UserPreferences extends EditablePreferences {
  appearance: AppearanceOption;
  emotionHapticsEnabled: boolean;
}

export type ScriptMood =
  | "confident"
  | "calm"
  | "playful"
  | "reflective"
  | "energetic";
