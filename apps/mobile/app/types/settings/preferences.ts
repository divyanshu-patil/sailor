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

// The picker's labels, shared by the settings section that sets the default and
// the wizard section that overrides it for one script. Values match ScriptMood
// on the API (app/utils/enums/user_enums.py).
export const MOOD_OPTIONS: { tag: ScriptMood; label: string }[] = [
  { tag: "confident", label: "Confident" },
  { tag: "calm", label: "Calm" },
  { tag: "playful", label: "Playful" },
  { tag: "reflective", label: "Reflective" },
  { tag: "energetic", label: "Energetic" },
];
