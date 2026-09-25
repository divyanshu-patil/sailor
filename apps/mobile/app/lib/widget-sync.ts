import { Platform } from "react-native";

import { streakDeadline } from "@/lib/streak-alarm";
import { useDailyStore } from "@/store/daily-store";
import { usePreferenceStore } from "@/store/preference-store";
import { mergeDays, shiftDate, weekPattern } from "@/lib/streak-days";
import { StreakWeekWidget } from "@/widgets/StreakWeekWidget";
import { StreakWidget } from "@/widgets/StreakWidget";
import { TodaysPracticeWidget } from "@/widgets/TodaysPracticeWidget";
import { DailyContentUnit, localDate, StreakState } from "@/types/daily";

import { widgetArtUri } from "./widget-assets";

/**
 * The app is the only thing that fetches. The widgets render whatever props they
 * were last handed, which is why they work offline and why they can never
 * disagree with the screen.
 *
 * The widgets own their own colour now — a widget's function body is serialised
 * whole, so constants declared inside it survive. What still has to be resolved
 * here is everything the widget's runtime genuinely cannot reach: the framework
 * label, the user's locale, the first sentence of the body, and the file paths
 * of the mascot PNGs in the App Group.
 */

/** The artwork the tiles wear. The small tile and the medium tile get
 *  different characters, the way the reference art does, which is why both
 *  paths are pushed — only the widget knows which family it is drawn at. */
const ART = {
  mascotSmall: "mascot-purple",
  mascotMedium: "mascot-cream",
  mascotStreak: "mascot-green",
  /** One face per streak state. Placeholders, same as every other mascot here —
   *  swapping the PNGs in assets/widgets/ changes the widget and nothing else. */
  mascotAlive: "mascot-green",
  mascotAtRisk: "mascot-cream",
  mascotBroken: "mascot-purple",
  plateSmall: "bg-cool-small",
  plateMedium: "bg-cool-medium",
  plateStreak: "bg-streak-cool",
  /** The medium week tile: body behind the day card, paws in front. */
  mascotWeek: "mascot-peek",
  mascotWeekPaws: "mascot-peek-paws",
  plateWeek: "bg-streak-week",
} as const;

/**
 * What today's snippet is FOR, as a tag.
 *
 * The tile used to show the framework it is built from — "PREP", "Feynman" —
 * which is craft detail: it answers "how is this structured", a question nobody
 * glancing at a home screen is asking, and it reads as jargon. The situation is
 * already on the unit; it just needs a human label, and the enum has to be
 * mapped somewhere the widget's runtime can't reach a table.
 */
const SITUATION_LABELS: Record<string, string> = {
  interview: "Interview",
  sales: "Sales Pitch",
  academic: "Academic Talk",
  business: "Business Update",
  conference: "Conference Talk",
  social: "Social Speaking",
  teaching: "Teaching",
  other: "Speaking",
  technical_explanation: "Explaining Tech",
  networking: "Networking",
  leadership_talk: "Leadership Talk",
  product_demo: "Product Demo",
};

/** Handwritten asides. Rotated by date so the tile isn't saying the same thing
 *  every day, and deliberately content-free — these are voice, not data, and a
 *  line that looked like data would be a line the user could not trust. */
const STREAK_NOTES = [
  "Keep going!",
  "Same you, brighter ideas.",
  "Still here. Nice.",
  "One more day.",
  "You showed up.",
  "Nice work, you.",
  "And we're back.",
  "Tiny win.",
  "Look at you go.",
  "Keep the spark.",
  "Still going strong.",
  "You got this.",
  "Just keep showing up.",
  "A little progress.",
  "Nice and steady.",
  "That's the spirit.",
  "Good things ahead.",
  "You're on a roll.",
  "One step more.",
  "Keep it going.",
  "Still moving.",
  "Glad you're here.",
  "Another one!",
  "That's a win.",
  "You're doing fine.",
  "Keep the momentum.",
  "Here we go.",
  "Quietly crushing it.",
  "Not bad, huh?",
  "You're still at it.",
  "Small steps count.",
  "Keep showing up.",
  "Good stuff.",
  "Back at it.",
  "Another day, another win.",
  "You're getting there.",
  "Nice little streak.",
  "Keep the rhythm.",
  "Onward!",
  "You're doing great.",
  "Just like that.",
  "One more.",
  "Still rolling.",
  "Look who's back.",
  "That's progress.",
  "Keep the good vibes.",
  "You're in motion.",
  "A win is a win.",
  "Doing your thing.",
  "Keep going, buddy.",
  "That's enough for today.",
];

/**
 * Picks a line from a pool.
 *
 * `salt` is what makes the streak note move when the streak does: keyed on the
 * date alone it only ever changed at midnight, so completing a day — the moment
 * the tile is most likely to be looked at — redrew the same sentence. Passing
 * the count and the status rotates it on every change as well as daily.
 */
function noteFor(
  pool: readonly string[],
  date: string,
  salt: number = 0,
): string {
  const day = Number(date.slice(8, 10));
  // Every caller passes a real local date; the fallback is for a malformed one.
  /* v8 ignore next */
  const base = Number.isFinite(day) ? day : 0;
  // Positive modulo: a negative salt would index off the front of the array.
  return pool[(((base + salt) % pool.length) + pool.length) % pool.length];
}

/**
 * The widget shows a taste of the snippet, not the paragraph — the first
 * sentence is the hook, and the tile is a reminder, not the practice itself.
 *
 * Trimmed to a length the tile can actually set rather than to a round number.
 * A 158pt-tall tile fits a two-line quote under the title and pill and above
 * the tip box, which is about 64 characters at the size the design asks for and
 * about 34 on systemSmall beside the character. Past that SwiftUI either
 * shrinks the text towards unreadable or cuts it mid-word, which is how it came
 * out reading "loud computing" instead of "Cloud computing" on a real home
 * screen. Cut on a word boundary so the ellipsis lands where a person would
 * put it.
 */
function trim(sentence: string, limit: number): string {
  if (sentence.length <= limit) return sentence;
  const cut = sentence.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

function firstSentenceOf(body: string): string {
  if (typeof body !== "string") return "";
  // `split` always returns at least one piece; the fallback only satisfies types.
  /* v8 ignore next */
  return body.trim().split(/(?<=[.!?])\s/)[0] ?? body.trim();
}

/** "Thu, Sep 18". Formatted here because the widget's JS runtime has no locale
 *  and the date is a plain `YYYY-MM-DD` string. The `T00:00:00` matters: without
 *  it the string parses as UTC and renders as the previous day west of Greenwich. */
function dateLabelFrom(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "";
  try {
    return parsed.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

/** Local midnight tonight — when tomorrow's entry should take over. */
function nextMidnight(): Date {
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  return midnight;
}

/**
 * Push today's content to the widget, with tomorrow's pre-scheduled when we have
 * it. The timeline entry is what makes the tile flip over on a day the app is
 * never opened — without it the widget would still be showing yesterday.
 */
export function syncPracticeWidget(
  today: DailyContentUnit | null | undefined,
  tomorrow: DailyContentUnit | null | undefined,
): void {
  if (Platform.OS !== "ios") return;
  if (!today?.body) return;

  const entryFor = (unit: DailyContentUnit) => {
    return {
      situationLabel: SITUATION_LABELS[unit.situation] ?? "Speaking",
      oneLiner: trim(firstSentenceOf(unit.body), 76),
      // Four lines of ~11 characters beside the character on systemSmall.
      oneLinerShort: trim(firstSentenceOf(unit.body), 40),
      // One short line inside the tip box. A longer tip is the app's job.
      tip: trim(unit.tip ?? "", 62),
      dateLabel: dateLabelFrom(unit.date),
      plateUri: widgetArtUri(ART.plateMedium) ?? "",
      plateSmallUri: widgetArtUri(ART.plateSmall) ?? "",
      mascotUri: widgetArtUri(ART.mascotMedium) ?? "",
      mascotSmallUri: widgetArtUri(ART.mascotSmall) ?? "",
    };
  };

  // Today goes up on its own first, and is never held back by tomorrow.
  //
  // The buffer can legitimately be short — a day the generation failed, or a
  // user reaching the end of the rolling window — and tomorrow is only ever an
  // optimisation (it saves the tile being stale for the few hours before the
  // app is next opened). Writing them in one call meant anything wrong with
  // tomorrow's unit cost the user today's tile as well, which is the wrong
  // trade in every case.
  try {
    TodaysPracticeWidget.updateSnapshot(entryFor(today));
  } catch (e) {
    // A widget that fails to update is a stale tile, not a broken app.
    console.log("practice widget update failed", e);
    return;
  }

  if (!tomorrow?.body) return;

  // Supersedes the snapshot above with the same entry plus tomorrow's, so the
  // tile flips over at local midnight even if the app is never opened that day.
  try {
    TodaysPracticeWidget.updateTimeline([
      { date: new Date(), props: entryFor(today) },
      { date: nextMidnight(), props: entryFor(tomorrow) },
    ]);
  } catch (e) {
    // Today's snapshot already landed, so this degrades to "correct until
    // midnight" rather than to nothing.
    console.log("practice widget timeline update failed", e);
  }
}

/**
 * What the widget says and shows for each streak state.
 *
 * The asides are per state rather than drawn from STREAK_NOTES: a broken streak
 * needs to say the one useful thing ("you can restore it"), and a generic
 * encouragement over a broken heart reads as the app not having noticed.
 */
const STATE_PRESENTATION = {
  alive: {
    icon: "flame",
    mascot: ART.mascotAlive,
    notes: STREAK_NOTES,
    link: "sailors://daily-practice",
  },
  atRisk: {
    icon: "hourglass",
    mascot: ART.mascotAtRisk,
    notes: [
      "Keep going,\nalmost there!",
      "Today is\nthe day!",
      "Don't lose\nit now!",
      "One practice\nkeeps it.",
    ],
    link: "sailors://daily-practice",
  },
  broken: {
    icon: "broken-heart",
    mascot: ART.mascotBroken,
    notes: [
      "It's okay,\nrestore it!",
      "Still fixable.\nTap to fix.",
      "One tap\nbrings it back.",
    ],
    // The one state where the tile is a shortcut to something other than
    // practice: while a restore is still possible, that is the thing to do.
    link: "sailors://streak-restore",
  },
  expired: {
    icon: "broken-heart",
    mascot: ART.mascotBroken,
    notes: [
      "Fresh start.\nBegin again!",
      "New streak,\nstarts today.",
      "Day one is\na good day.",
    ],
    link: "sailors://daily-practice",
  },
} as const;

/**
 * Which state a streak is in, from the widget's point of view.
 *
 * `expired` is its own case rather than folded into `broken`: once the restore
 * window has closed the tile must stop offering a restore, and the copy has to
 * change from "you can bring it back" to "start again" — otherwise it sends
 * people to a screen that will only refuse them.
 */
function widgetStatus(
  streak: StreakState,
  atRisk: boolean,
): keyof typeof STATE_PRESENTATION {
  if (streak.currentStreak > 0) return atRisk ? "atRisk" : "alive";
  return streak.canRestore ? "broken" : "expired";
}

export function syncStreakWidget(
  streak: StreakState | null | undefined,
  backgroundColor: string,
  atRisk = false,
): void {
  if (Platform.OS !== "ios") return;
  // No streak yet means the app has nothing to say — leaving the widget on its
  // "Open Sailors" placeholder is better than pushing a 0 that isn't true.
  if (typeof streak?.currentStreak !== "number") return;

  // The streak has no date of its own, and `toISOString()` would answer in UTC
  // — the one thing types/daily warns against, because it hands the wrong day
  // to everyone east of GMT in the morning.
  const date = localDate();
  const status = widgetStatus(streak, atRisk);
  const presentation = STATE_PRESENTATION[status];

  try {
    StreakWidget.updateSnapshot({
      streakCount: streak.currentStreak,
      // The number sits above it, so one label reads correctly for any count.
      label: "day streak",
      status,
      deepLink: presentation.link,
      // Salted with the count and whether today is done, so the line changes
      // when the streak does rather than only when the date does.
      note: noteFor(
        presentation.notes,
        date,
        streak.currentStreak * 2 + (streak.completedToday ? 1 : 0),
      ),
      accentColor: backgroundColor,
      iconUri: widgetArtUri(presentation.icon) ?? "",
      plateUri: widgetArtUri(ART.plateStreak) ?? "",
      mascotUri: widgetArtUri(presentation.mascot) ?? "",
    });
  } catch (e) {
    console.log("streak widget update failed", e);
  }

  syncStreakWeekWidget(streak, status, date);
}

/** Short enough for the pill on the week tile — one line, no wrapping. */
const WEEK_NOTES = {
  alive: [
    "Keep going!",
    "On a roll!",
    "Nice work!",
    "Look at you!",
    "Keep it up!",
    "Onward!",
    "You got this!",
    "Tiny wins!",
  ],
  atRisk: ["Practise today!", "Don't break it!", "Almost there!"],
  broken: ["Tap to restore"],
  expired: ["Fresh start!", "Day one today!"],
} as const;

/**
 * The medium tile: the count, and the week it sits in.
 *
 * The week comes from the per-day log (lib/streak-days) unioned with the
 * current run, so a simulated streak from the dev section still draws its days
 * without ever being written to the log.
 *
 * Two timeline entries, because the row is about *today*: at midnight today's
 * dot becomes a tick or a gap, and on Monday the row starts over. Without the
 * second entry a tile nobody opens the app for keeps showing yesterday's week.
 */
function syncStreakWeekWidget(
  streak: StreakState,
  status: keyof typeof STATE_PRESENTATION,
  date: string,
): void {
  const run = mergeDays(
    useDailyStore.getState().completedDays ?? [],
    streak,
    date,
  );
  const count = streak.currentStreak;
  const salt = count * 2 + (streak.completedToday ? 1 : 0);

  const entryFor = (day: string) => ({
    streakCount: count,
    line1: count === 1 ? "day" : "days",
    line2:
      status === "broken" || status === "expired"
        ? "streak lost"
        : count === 1
          ? "and counting!"
          : "in a row!",
    note: noteFor(WEEK_NOTES[status], day, salt),
    status,
    week: weekPattern(run, day),
    deepLink: STATE_PRESENTATION[status].link,
    flameUri: widgetArtUri("flame-soft") ?? "",
    plateUri: widgetArtUri(ART.plateWeek) ?? "",
    mascotUri: widgetArtUri(ART.mascotWeek) ?? "",
    pawsUri: widgetArtUri(ART.mascotWeekPaws) ?? "",
  });

  try {
    StreakWeekWidget.updateTimeline([
      { date: new Date(), props: entryFor(date) },
      { date: nextMidnight(), props: entryFor(shiftDate(date, 1)) },
    ]);
  } catch (e) {
    console.log("streak week widget update failed", e);
  }
}

/**
 * Re-push the streak widget whenever the streak or its colour changes.
 *
 * Watches the streak itself, not just the Settings colour, because the colour
 * was never the only live input and pushing from the *writer* does not scale:
 * `useDailyPractice` remembered to, the dev simulator in Settings did not, and
 * the restore flow would have been a third place to forget. The widget then sat
 * on a stale number until something else happened to push it.
 *
 * Watching the store instead means every writer is covered by construction —
 * `setStreak` is the one door they all go through — and a new one cannot
 * forget. Mounted at the root, so it outlives any screen.
 */
export function startStreakWidgetSync(): () => void {
  const colorOf = () =>
    usePreferenceStore.getState().preferences.streakWidgetColor;

  let color = colorOf();
  let streak = useDailyStore.getState().streak;

  const push = () => {
    const { streak: next, pendingCompleteDate } = useDailyStore.getState();
    if (!next) return;
    // Derived here rather than inside syncStreakWidget so the tile and the
    // countdown banner cannot disagree about the same streak — streakDeadline
    // is the one place that knows when a streak dies.
    const atRisk = streakDeadline(next, pendingCompleteDate)?.atRisk ?? false;
    syncStreakWidget(next, colorOf(), atRisk);
  };

  const unsubColor = usePreferenceStore.subscribe(() => {
    if (colorOf() === color) return;
    color = colorOf();
    push();
  });

  // Reference equality is enough: the store only ever replaces the streak
  // object, never mutates it in place. This is what makes the dev section's
  // buttons move the widget too — they write the same store every other path
  // writes, and nothing here cares where the value came from.
  const unsubStreak = useDailyStore.subscribe(() => {
    const next = useDailyStore.getState().streak;
    if (next === streak) return;
    streak = next;
    push();
  });

  return () => {
    unsubColor();
    unsubStreak();
  };
}

/**
 * Re-push both widgets from the cache.
 *
 * Needed because the mascot paths only exist once `primeWidgetAssets` has
 * finished copying, and the first fetch of a session can easily beat it —
 * a plain reload would just re-render the characterless props already stored.
 */
export function resyncWidgets(): void {
  if (Platform.OS !== "ios") return;

  const { unit, tomorrow, streak } = useDailyStore.getState();
  if (unit) syncPracticeWidget(unit, tomorrow);
  if (streak) {
    syncStreakWidget(
      streak,
      usePreferenceStore.getState().preferences.streakWidgetColor,
    );
  }
  reloadWidgets();
}

/**
 * Force both widgets to re-render once, at app start.
 *
 * `createWidget` writes the layout into the App Group but does NOT reload —
 * only `updateTimeline` does (see expo-widgets ios/WidgetObject.swift). So a
 * widget added to the home screen before the app had ever run renders
 * "No layout found" as a red box, and WidgetKit keeps that cached result until
 * something reloads it. Nothing would, because the first `updateTimeline` only
 * happens after a successful content fetch — which is exactly the moment that
 * is missing when the backend has no content yet.
 *
 * One reload at launch, after the widget modules have been imported and their
 * layouts written, is what breaks that deadlock.
 */
export function reloadWidgets(): void {
  if (Platform.OS !== "ios") return;

  try {
    TodaysPracticeWidget.reload();
    StreakWidget.reload();
    StreakWeekWidget.reload();
  } catch (e) {
    console.log("widget reload failed", e);
  }
}
