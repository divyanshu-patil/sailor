import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { useAppUserStore } from "@/store/app-user.store";
import { usePreferenceStore } from "@/store/preference-store";

import { dailyReminderFor } from "./notification-copy";

/**
 * The daily practice reminder.
 *
 * Local notifications, no push and no server: iOS fires them whether or not the
 * app has run, which is the whole point of a habit reminder. A month of them,
 * one per date, rather than a single repeating trigger — a repeating trigger
 * carries the content it was scheduled with, so it said the same line every
 * evening until the app was opened again. Dated ones each get their own line
 * (see notification-copy). Thirty plus the streak ladder's five stays well
 * under iOS's 64 pending; every launch and every settings change reschedules
 * the month from today.
 *
 * The toggle and the time picker already existed in Settings
 * (screens/settings/PracticeSection) and were writing preferences nothing acted
 * on. This is the missing half.
 */

/** The single repeating reminder earlier builds scheduled — cancelled so an
 *  upgrade doesn't fire it alongside the dated ones. */
const LEGACY_IDENTIFIER = "daily-practice-reminder";
const DAYS_AHEAD = 30;
const idFor = (i: number) => `${LEGACY_IDENTIFIER}-${i}`;

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

/** Checks, never asks. The syncs run at launch, and the system prompt belongs
 *  to the onboarding step that explains it, not to the first frame. */
export const hasNotificationPermission = async () =>
  (await Notifications.getPermissionsAsync()).granted;

const grantListeners = new Set<() => void>();

/** Called when a prompt is answered yes: the launch syncs found no permission
 *  and scheduled nothing, so they have to run again. */
export function onNotificationGrant(listener: () => void): () => void {
  grantListeners.add(listener);
  return () => grantListeners.delete(listener);
}

/** Shows the system prompt. Only for a deliberate user action — the onboarding
 *  step, or turning reminders on in settings. */
export async function ensureNotificationPermission(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  // Don't re-prompt once the user has said no — iOS won't show the sheet again
  // anyway, and asking turns a denied permission into a silent failure loop.
  if (!existing.canAskAgain) return false;

  const { granted } = await Notifications.requestPermissionsAsync();
  if (granted) grantListeners.forEach((listener) => listener());
  return granted;
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

  // Nothing scheduled under an id is expected (a first run), so a miss is fine.
  await Promise.all(
    [LEGACY_IDENTIFIER, ...Array.from({ length: DAYS_AHEAD }, (_, i) => idFor(i))].map(
      (id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {}),
    ),
  );

  if (!enabled) return false;
  if (!(await hasNotificationPermission())) return false;

  const [h, m] = time.split(":").map(Number);
  const hour = Number.isFinite(h) ? h! : 18;
  const minute = Number.isFinite(m) ? m! : 0;
  const nickname = useAppUserStore.getState().appUser?.nickname;

  // From today if its time is still ahead, otherwise from tomorrow.
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute);
  if (first <= now) first.setDate(first.getDate() + 1);

  await Promise.all(
    Array.from({ length: DAYS_AHEAD }, (_, i) => {
      const at = new Date(first);
      at.setDate(first.getDate() + i);
      const { title, body } = dailyReminderFor(at, nickname);
      return Notifications.scheduleNotificationAsync({
        identifier: idFor(i),
        content: {
          title,
          body,
          // Read by the notification tap handler in routes/_layout to deep-link.
          data: { url: "sailors://daily-practice" },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: at,
        },
      });
    }),
  );

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
  const sync = () =>
    void syncDailyReminder(
      previous.practiceRemindersEnabled,
      previous.practiceReminderTime,
    );
  sync();
  const stopGrant = onNotificationGrant(sync);

  const stopPrefs = usePreferenceStore.subscribe(() => {
    const next = read();
    if (
      next.practiceRemindersEnabled === previous.practiceRemindersEnabled &&
      next.practiceReminderTime === previous.practiceReminderTime
    ) {
      return;
    }
    previous = next;
    sync();
  });

  return () => {
    stopPrefs();
    stopGrant();
  };
}
