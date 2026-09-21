import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { usePreferenceStore } from "@/store/preference-store";

/**
 * The daily practice reminder.
 *
 * One local notification on a repeating daily trigger — no push, no server, no
 * scheduling of 30 individual notifications. iOS fires it whether or not the app
 * has run, which is the whole point of a habit reminder.
 *
 * The toggle and the time picker already existed in Settings
 * (screens/settings/PracticeSection) and were writing preferences nothing acted
 * on. This is the missing half.
 */

const IDENTIFIER = "daily-practice-reminder";

/** Fires the reminder even while the app is foregrounded — otherwise a user who
 *  happens to have Sailors open at 18:00 silently loses that day's nudge. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationPermission(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  // Don't re-prompt once the user has said no — iOS won't show the sheet again
  // anyway, and asking turns a denied permission into a silent failure loop.
  if (!existing.canAskAgain) return false;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/**
 * Bring the scheduled reminder in line with the user's preferences.
 *
 * Safe to call repeatedly — it cancels by a fixed identifier before scheduling,
 * so changing the time twice leaves one notification, not three. Returns whether
 * a reminder is now scheduled, so a caller can tell the difference between "off"
 * and "permission denied" if it wants to; nothing throws on denial, because a
 * reminder the user refused should degrade the feature, not break it.
 */
export async function syncDailyReminder(
  enabled: boolean,
  time: string,
): Promise<boolean> {
  if (Platform.OS === "web") return false;

  try {
    await Notifications.cancelScheduledNotificationAsync(IDENTIFIER);
  } catch {
    // Nothing was scheduled under that id. Expected on a first run.
  }

  if (!enabled) return false;
  if (!(await ensureNotificationPermission())) return false;

  const [hour, minute] = time.split(":").map(Number);

  await Notifications.scheduleNotificationAsync({
    identifier: IDENTIFIER,
    content: {
      title: "Today's practice",
      body: "Two sentences, ten seconds. Keep the streak going.",
      // Read by the notification tap handler in routes/_layout to deep-link.
      data: { url: "sailors://daily-practice" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: Number.isFinite(hour) ? hour : 18,
      minute: Number.isFinite(minute) ? minute : 0,
    },
  });

  return true;
}

/**
 * Keep the OS schedule in step with the preference store, for the life of the app.
 *
 * A subscription rather than a call at each write site: the reminder fields are
 * changed by the settings screen, by the sync from the server on launch, and by
 * a cache clear resetting to defaults. Hooking the store once covers all three —
 * and covers the next one nobody remembers to wire up.
 */
export function startReminderSync(): () => void {
  const read = () => {
    const { practiceRemindersEnabled, practiceReminderTime } =
      usePreferenceStore.getState().preferences;
    return { practiceRemindersEnabled, practiceReminderTime };
  };

  let previous = read();
  void syncDailyReminder(
    previous.practiceRemindersEnabled,
    previous.practiceReminderTime,
  );

  return usePreferenceStore.subscribe(() => {
    const next = read();
    if (
      next.practiceRemindersEnabled === previous.practiceRemindersEnabled &&
      next.practiceReminderTime === previous.practiceReminderTime
    ) {
      return;
    }
    previous = next;
    void syncDailyReminder(
      next.practiceRemindersEnabled,
      next.practiceReminderTime,
    );
  });
}
