export interface UserPreferences {
  appearanceId: string;
  emotionHapticsEnabled: boolean;
  practiceRemindersEnabled: boolean;
  /** 24h local time, "HH:mm" */
  practiceReminderTime: string;
  defaultMood: ScriptMood;
}

export type ScriptMood =
  | "confident"
  | "calm"
  | "playful"
  | "reflective"
  | "energetic";
