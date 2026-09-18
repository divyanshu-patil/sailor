import { Presets, Settings } from "react-native-pulsar";

import { usePreferenceStore } from "@/store/preference-store";

/**
 * Haptics, gated on the user's preference.
 *
 * `emotionHapticsEnabled` has been in Settings since before this feature, with
 * a toggle the user could flip and nothing anywhere reading it — every Pulsar
 * call in the app fired regardless. Rather than add a check at each call site
 * (there are already several, in the script wizard and the value dial), this
 * drives Pulsar's own global switch from the store.
 *
 * That fixes the existing call sites as a side effect, which is the point: a
 * guard in the one place every preset call already routes through is a smaller
 * change than a guard in each of them, and it cannot be forgotten by the next
 * one somebody adds.
 *
 * Resolved package: react-native-pulsar 1.7.0 (declared ^1.6.1). Presets are
 * worklet-safe no-arg functions, so they are equally callable from a gesture
 * handler on the UI thread or from JS.
 */
export function startHapticsSync(): () => void {
  const read = () => usePreferenceStore.getState().preferences.emotionHapticsEnabled;

  let previous = read();
  Settings.enableHaptics(previous);

  return usePreferenceStore.subscribe(() => {
    const next = read();
    if (next === previous) return;
    previous = next;
    Settings.enableHaptics(next);
  });
}

/**
 * The daily-practice vocabulary.
 *
 * Named by what happened rather than by how it feels, so the mapping can be
 * retuned in one place. Each is a Pulsar preset chosen for the event's meaning:
 * a selection tick for moving between lines (frequent, low-stakes, reversible),
 * a firmer impact for committing to start, and a celebratory pattern reserved
 * for the once-a-day completion so it stays special.
 */
export const haptics = {
  /** Entering the flow — a deliberate, committed press. */
  start: () => Presets.System.impactMedium(),
  /** Moving to the next line. Happens several times a minute, so it stays
   *  light; anything heavier becomes fatiguing fast. */
  advance: () => Presets.System.selection(),
  /** Stepping backwards — same weight as advancing, it is the same kind of move. */
  back: () => Presets.System.selection(),
  /** The last line is done, but nothing has been committed yet. */
  finishLine: () => Presets.System.impactLight(),
  /** Streak incremented. Once a day, so it can afford to be a moment. */
  celebrate: () => Presets.applause(),
  /** A completion that failed to reach the server and was queued instead. */
  warn: () => Presets.System.notificationWarning(),
};
