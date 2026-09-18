import { Platform } from "react-native";

import { useDailyStore } from "@/store/daily-store";
import { usePreferenceStore } from "@/store/preference-store";
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

/**
 * Which of the two colour stories today gets.
 *
 * By the day of the month, so it alternates every morning and both widgets
 * agree without either having to be told about the other. Derived rather than
 * stored: a value in the preference store would be one more thing that can
 * drift out of step between the two tiles.
 */
function variationFor(date: string): "warm" | "cool" {
  const day = Number(date.slice(8, 10));
  return Number.isFinite(day) && day % 2 === 0 ? "cool" : "warm";
}

/** The artwork each variation wears. All five baked characters are used: the
 *  small tile and the medium tile get different ones, the way the reference art
 *  does, which is why both paths are pushed — only the widget knows which
 *  family it is being drawn at. */
const ART = {
  warm: {
    mascotSmall: "mascot-cream",
    mascotMedium: "mascot-pink",
    mascotStreak: "mascot-blue",
    plateSmall: "bg-warm-small",
    plateMedium: "bg-warm-medium",
    plateStreak: "bg-streak-warm",
  },
  cool: {
    mascotSmall: "mascot-purple",
    mascotMedium: "mascot-cream",
    mascotStreak: "mascot-green",
    plateSmall: "bg-cool-small",
    plateMedium: "bg-cool-medium",
    plateStreak: "bg-streak-cool",
  },
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
];

function noteFor(pool: readonly string[], date: string): string {
  const day = Number(date.slice(8, 10));
  return pool[(Number.isFinite(day) ? day : 0) % pool.length];
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
    const variation = variationFor(unit.date);
    const art = ART[variation];
    return {
      variation,
      situationLabel: SITUATION_LABELS[unit.situation] ?? "Speaking",
      oneLiner: trim(firstSentenceOf(unit.body), 76),
      oneLinerShort: trim(firstSentenceOf(unit.body), 48),
      // One short line inside the tip box. A longer tip is the app's job.
      tip: trim(unit.tip ?? "", 62),
      dateLabel: dateLabelFrom(unit.date),
      plateUri: widgetArtUri(art.plateMedium) ?? "",
      plateSmallUri: widgetArtUri(art.plateSmall) ?? "",
      mascotUri: widgetArtUri(art.mascotMedium) ?? "",
      mascotSmallUri: widgetArtUri(art.mascotSmall) ?? "",
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

export function syncStreakWidget(
  streak: StreakState | null | undefined,
  backgroundColor: string,
): void {
  if (Platform.OS !== "ios") return;
  // No streak yet means the app has nothing to say — leaving the widget on its
  // "Open Sailor" placeholder is better than pushing a 0 that isn't true.
  if (typeof streak?.currentStreak !== "number") return;

  // The streak has no date of its own, and `toISOString()` would answer in UTC
  // — the one thing types/daily warns against, because it hands the wrong day
  // to everyone east of GMT in the morning.
  const date = localDate();
  const variation = variationFor(date);

  try {
    StreakWidget.updateSnapshot({
      variation,
      streakCount: streak.currentStreak,
      // The number sits above it, so one label reads correctly for any count.
      label: "day streak",
      note: noteFor(STREAK_NOTES, date),
      accentColor: backgroundColor,
      plateUri: widgetArtUri(ART[variation].plateStreak) ?? "",
      mascotUri: widgetArtUri(ART[variation].mascotStreak) ?? "",
    });
  } catch (e) {
    console.log("streak widget update failed", e);
  }
}

/**
 * Re-push the streak widget whenever the colour picked in Settings changes.
 *
 * It tints the heart sticker now rather than the whole tile — the background is
 * a baked plate — but it is still a live setting, so it still has to be pushed.
 *
 * Same reasoning as the reminder's subscription: the picker isn't the only thing
 * that can change that value (a cache clear resets it to the default), and the
 * daily-practice hook is only mounted while its screen is. One subscription,
 * mounted at the root, covers every path.
 */
export function startStreakWidgetSync(): () => void {
  let previous = usePreferenceStore.getState().preferences.streakWidgetColor;

  return usePreferenceStore.subscribe(() => {
    const next = usePreferenceStore.getState().preferences.streakWidgetColor;
    if (next === previous) return;
    previous = next;

    const streak = useDailyStore.getState().streak;
    if (streak) syncStreakWidget(streak, next);
  });
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
    syncStreakWidget(streak, usePreferenceStore.getState().preferences.streakWidgetColor);
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
  } catch (e) {
    console.log("widget reload failed", e);
  }
}
