import { ScriptMood } from "@/types/settings/preferences";

/**
 * The named structure a day's snippet demonstrates — "PREP", "STAR", "SCQA", ...
 *
 * Typed as a plain string rather than a union of the 22 current ids, on purpose.
 * The framework library (backend: services/daily/frameworks.py) is an explicitly
 * growing seed set, and the app does nothing per-framework: it shows the label
 * the API sends and derives a colour by hashing the id. A union here would be a
 * second copy of that table, needing a client release every time someone adds a
 * framework, for no type safety anyone would use.
 */
export type FrameworkId = string;

export type MoodTag = ScriptMood;

/** Mirrors SituationTag on the API (app/utils/enums/daily_enums.py). The first
 *  eight match DeckCategory; the last four are speaking scenarios a deck
 *  category never covered. */
export type SituationTag =
  | "interview"
  | "sales"
  | "academic"
  | "business"
  | "conference"
  | "social"
  | "teaching"
  | "other"
  | "technical_explanation"
  | "networking"
  | "leadership_talk"
  | "product_demo";

export interface DailyContentUnit {
  id: string;
  /** What this snippet is ABOUT ("Explaining Cloud Computing") — the speech's
   *  topic, not the framework it uses. Shown as "Today's topic". */
  title: string;
  /** ISO date (YYYY-MM-DD) this was generated for. */
  date: string;
  framework: FrameworkId;
  /** Human label for `framework`, resolved server-side so the app never holds
   *  its own copy of the framework table. */
  frameworkLabel: string;
  /** The framework's step order, e.g. ["Point", "Reason", "Example", "Point"].
   *  Shown on the intro screen so the user knows the structure before reading
   *  the snippet that demonstrates it. */
  frameworkSteps: string[];
  /** One line on what the framework is for, shown behind the info button. */
  frameworkDescription: string;
  /** One gloss per step, positionally aligned with `frameworkSteps`. */
  frameworkStepHints: string[];
  /** Human labels for the situations this framework suits. */
  frameworkBestFor: string[];
  /** Lucide glyph name for the explainer's header tile. */
  frameworkIcon: string;
  mood: MoodTag;
  situation: SituationTag;
  /** 2-3 speakable sentences applying the framework. The screen's visual focus. */
  body: string;
  /** One line, names the framework and gives a delivery cue. */
  tip: string;
  variationIndex: number;
}

export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  lastCompletedDate: string | null;
  completedToday: boolean;
}

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
