import type { StreakState } from "@/types/daily";

/**
 * Per-day streak history, for the week row on the streak widget.
 *
 * The server only keeps counters (current, longest, last completed date), not a
 * log of days. The current run is fully recoverable from those — it is the
 * `currentStreak` consecutive days ending on `lastCompletedDate` — so that is
 * where each day comes from. What the counters forget is a day completed before
 * a break, which is why the app also keeps the dates it has seen.
 *
 * No imports beyond a type, so scripts/check-streak-days.mjs can run it under
 * plain node.
 */

/** Same format as `localDate` in types/daily — local, never UTC. */
function format(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** `T00:00:00` so the string parses as local midnight, not UTC. */
function shift(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return format(d);
}

/** How far back the log reaches. The widget shows one week; two covers a week
 *  that started before the last time the app was opened. */
const KEEP_DAYS = 14;

/** The dates the current run covers, newest first, capped at the log's reach. */
export function runDates(
  streak: Pick<StreakState, "currentStreak" | "lastCompletedDate">,
): string[] {
  const last = streak.lastCompletedDate;
  if (!last || !(streak.currentStreak > 0)) return [];
  const n = Math.min(Math.trunc(streak.currentStreak), KEEP_DAYS);
  return Array.from({ length: n }, (_, i) => shift(last, -i));
}

/** Folds the run into the log and drops anything older than it needs. */
export function mergeDays(
  log: readonly string[],
  streak: Pick<StreakState, "currentStreak" | "lastCompletedDate">,
  today: string,
): string[] {
  const cutoff = shift(today, -(KEEP_DAYS - 1));
  return [...new Set([...log, ...runDates(streak)])]
    .filter((d) => d >= cutoff && d <= today)
    .sort();
}

/**
 * Monday to Sunday of the week holding `today`, one letter per day:
 * `D` done, `M` missed, `T` today and not done yet, `F` still to come.
 *
 * A string rather than an array because it crosses into the widget's runtime,
 * where every prop has to be validated by hand — seven letters from a known
 * set is one regex.
 */
export function weekPattern(done: Iterable<string>, today: string): string {
  const set = new Set(done);
  const weekday = (new Date(`${today}T00:00:00`).getDay() + 6) % 7; // Mon = 0
  const monday = shift(today, -weekday);
  let out = "";
  for (let i = 0; i < 7; i++) {
    const day = shift(monday, i);
    out += set.has(day) ? "D" : day < today ? "M" : day === today ? "T" : "F";
  }
  return out;
}

export { shift as shiftDate };
