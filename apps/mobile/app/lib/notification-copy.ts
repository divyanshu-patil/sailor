/**
 * Every word the app puts in a notification.
 *
 * There was no such file: the daily nudge was written inline inside
 * `scheduleNotificationAsync` in `daily-reminder.ts`, and the streak ladder was
 * an `ALERTS` array halfway down `streak-alarm.ts`. So the only copy a user
 * sees when the app is closed lived in two places, neither of them obvious, and
 * changing a word meant reading scheduling logic first. It lives here now —
 * copy in one file, timing and permissions in theirs.
 *
 * House style for this file: lowercase, short, and a bit dry. These arrive on a
 * lock screen next to everything else competing for the same glance, so they
 * read like a person and not a product. Urgency comes from the facts — hours
 * left, days at stake — never from guilt-tripping on top of them, which is how
 * an app gets its notifications turned off for good.
 */

/** The 6pm-ish habit nudge. */
export const DAILY_REMINDER_TITLE = "today's practice";

/**
 * Four ways to say the same thing.
 *
 * One fixed string repeated every evening stops being read within a week — it
 * becomes furniture. A daily trigger carries whatever content it was scheduled
 * with, so the line cannot rotate on its own; `startReminderSync` reschedules
 * on every app launch, and picking here means the wording changes each time the
 * app is opened. Someone who never opens it keeps the same line, which is fine:
 * they are not the one getting bored of it.
 */
export const DAILY_REMINDER_BODIES = [
  "two sentences, ten seconds. that's the whole ask.",
  "ten seconds of practice beats another hour of scrolling, probably.",
  "your streak is lowkey counting on you rn.",
  "quick one before the day's gone — you'll sound better for it.",
] as const;

/** A line for tonight's reminder. Called at schedule time, not at fire time. */
export const pickDailyReminderBody = () =>
  DAILY_REMINDER_BODIES[
    Math.floor(Math.random() * DAILY_REMINDER_BODIES.length)
  ]!;

/**
 * The streak ladder, escalating toward the deadline.
 *
 * Offsets ride along with the words because the two were written together — how
 * hard a line pushes only makes sense next to how long is left. Relative to the
 * moment the streak resets; the last one is positive, so it lands the morning
 * after, and only survives if the user never came back to reschedule it.
 *
 * Same voice as the nudge above, but the numbers are left alone on purpose.
 * "4 hours left", "15 minutes", the day count — that is the whole payload, and
 * it is what someone acts on from a lock screen without opening anything. The
 * casual register is in how it is said, never in what is withheld. The tone
 * also stops escalating before the last one: a streak that already ended is not
 * a moment to be breezy at someone about.
 */
export const STREAK_ALERTS: {
  offset: number;
  title: (n: number) => string;
  body: (n: number) => string;
}[] = [
  {
    offset: -4 * 60 * 60 * 1000,
    title: (n) => `🔥 your ${n}-day streak is on the line`,
    body: () => "4 hours left. one snippet and it's safe.",
  },
  {
    offset: -2 * 60 * 60 * 1000,
    title: () => "⏳ 2 hours left to save your streak",
    body: (n) => `${n} days of practice, gone at midnight, unless you show up.`,
  },
  {
    offset: -1 * 60 * 60 * 1000,
    title: () => "🚨 1 hour until your streak resets",
    body: (n) =>
      `your ${n}-day streak hits zero at midnight. it takes a minute.`,
  },
  {
    offset: -15 * 60 * 1000,
    title: () => "🚨 15 minutes. last call.",
    body: (n) => `${n} days about to disappear. go.`,
  },
  {
    offset: 9 * 60 * 60 * 1000,
    title: (n) => `💔 your ${n}-day streak ended`,
    body: () => "day one is genuinely the easiest. start another today.",
  },
];
