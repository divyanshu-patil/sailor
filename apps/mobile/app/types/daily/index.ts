import { ScriptMood } from "@/types/settings/preferences";

/**
 * A day's theme. Mirrors DailyContentType on the API
 * (app/models/daily_model.py) — the same type for every user on a given day,
 * so this label is a statement about today rather than about the account.
 */
export type ContentType =
  | "opening_hook"
  | "ending"
  | "structure"
  | "filler_alternative"
  | "story_anecdote"
  | "general_tip";

export type MoodTag = ScriptMood;

/** Mirrors DeckCategory on the API — the same closed list Discover files decks
 *  under, reused rather than duplicated as a parallel "situation" vocabulary. */
export type SituationTag =
  | "interview"
  | "sales"
  | "academic"
  | "business"
  | "conference"
  | "social"
  | "teaching"
  | "other";

export interface DailyContentUnit {
  id: string;
  /** ISO date (YYYY-MM-DD) this was generated for. */
  date: string;
  type: ContentType;
  mood: MoodTag;
  situation: SituationTag;
  /** 2-3 speakable sentences. The screen's whole visual focus. */
  body: string;
  /** One line, under ~15 words. */
  tip: string;
  variationIndex: number;
}

export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  lastCompletedDate: string | null;
  completedToday: boolean;
}

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  opening_hook: "Openings",
  ending: "Endings",
  structure: "Structure",
  filler_alternative: "Instead of filler",
  story_anecdote: "Stories",
  general_tip: "Delivery",
};

/**
 * The device's local calendar date, as YYYY-MM-DD.
 *
 * Every daily-practice call takes this. `toISOString()` is deliberately not used
 * — it converts to UTC first, so anyone east of GMT in the morning or west of it
 * in the evening gets yesterday's or tomorrow's date, which is precisely how a
 * streak silently breaks.
 */
export const localDate = (date: Date = new Date()): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
