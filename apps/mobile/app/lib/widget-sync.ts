import { Platform } from "react-native";

import { paletteColorAt } from "@/constants/deck-palette";
import { useDailyStore } from "@/store/daily-store";
import { usePreferenceStore } from "@/store/preference-store";
import { StreakWidget } from "@/widgets/StreakWidget";
import { TodaysPracticeWidget } from "@/widgets/TodaysPracticeWidget";
import {
  CONTENT_TYPE_LABELS,
  ContentType,
  DailyContentUnit,
  StreakState,
} from "@/types/daily";

/**
 * The app is the only thing that fetches. The widgets render whatever props they
 * were last handed, which is why they work offline and why they can never
 * disagree with the screen.
 *
 * Every resolution a widget would otherwise have to do — the label for a type,
 * the gradient for it, the first line of the body — happens here, because a
 * `'widget'` component may not reference module-scope constants.
 */

const TYPE_ORDER: ContentType[] = [
  "opening_hook",
  "ending",
  "structure",
  "filler_alternative",
  "story_anecdote",
  "general_tip",
];

/** Two neighbouring shades from the app's existing deck palette, so the widget
 *  belongs to the same world as the decks rather than introducing a second set
 *  of brand colours nobody maintains. */
function gradientFor(type: ContentType): [string, string] {
  const index = Math.max(0, TYPE_ORDER.indexOf(type));
  return [paletteColorAt(index), paletteColorAt(index + 1)];
}

/** The widget shows one line, not the paragraph — the first sentence is the
 *  hook, and the tile is a reminder, not the practice itself. */
function oneLinerFrom(body: string): string {
  const firstSentence = body.trim().split(/(?<=[.!?])\s/)[0] ?? body.trim();
  return firstSentence.length > 120
    ? `${firstSentence.slice(0, 117).trimEnd()}…`
    : firstSentence;
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
  today: DailyContentUnit,
  tomorrow: DailyContentUnit | null,
): void {
  if (Platform.OS !== "ios") return;

  const entryFor = (unit: DailyContentUnit) => ({
    typeLabel: CONTENT_TYPE_LABELS[unit.type] ?? "Practice",
    oneLiner: oneLinerFrom(unit.body),
    gradientColors: gradientFor(unit.type),
  });

  try {
    if (tomorrow) {
      TodaysPracticeWidget.updateTimeline([
        { date: new Date(), props: entryFor(today) },
        { date: nextMidnight(), props: entryFor(tomorrow) },
      ]);
    } else {
      TodaysPracticeWidget.updateSnapshot(entryFor(today));
    }
  } catch (e) {
    // A widget that fails to update is a stale tile, not a broken app. Never
    // let it take the screen down with it.
    console.log("practice widget update failed", e);
  }
}

export function syncStreakWidget(streak: StreakState, backgroundColor: string): void {
  if (Platform.OS !== "ios") return;

  try {
    StreakWidget.updateSnapshot({
      streakCount: streak.currentStreak,
      backgroundColor,
      // The number sits above it, so one label reads correctly for any count.
      label: "day streak",
    });
  } catch (e) {
    console.log("streak widget update failed", e);
  }
}

/**
 * Re-push the streak widget whenever the colour picked in Settings changes.
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
