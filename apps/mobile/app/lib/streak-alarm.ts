import * as Notifications from "expo-notifications";
import { AppState, Platform } from "react-native";

import { dailyPracticeService } from "@/services/daily-practice.service";
import { useDailyStore } from "@/store/daily-store";
import { usePreferenceStore } from "@/store/preference-store";
import { localDate, StreakState } from "@/types/daily";

import { ensureNotificationPermission } from "./daily-reminder";

/**
 * The "your streak is about to die" mechanism.
 *
 * The server resets a streak on read once a full day has passed without a
 * completion (daily_controller.get_streak), so the moment a streak dies is
 * knowable on the device: local midnight at the end of the day after the last
 * completion. Everything here is derived from that one instant.
 *
 * Local notifications, not push: they are scheduled against that instant and
 * iOS fires them whether or not the app ever runs again — which is exactly the
 * user they are for. Every change to the streak reschedules, so practising
 * cancels tonight's alarms and arms tomorrow's.
 */

export interface StreakDeadline {
  /** Local midnight when the streak resets to zero. */
  deadline: Date;
  count: number;
  /** Not practised today — today is the last day to save it. */
  atRisk: boolean;
}

export function streakDeadline(
  streak: StreakState | null,
  pendingCompleteDate: string | null,
  now: Date = new Date(),
): StreakDeadline | null {
  if (!streak || streak.currentStreak <= 0) return null;

  // A completion queued offline counts: the user did practise.
  const last = [streak.lastCompletedDate, pendingCompleteDate]
    .filter((d): d is string => !!d)
    .sort()
    .pop();
  if (!last) return null;

  const [y, m, d] = last.split("-").map(Number);
  // Day after `last` is the grace day; the streak dies when it ends.
  const deadline = new Date(y, m - 1, d + 2);
  if (!(deadline > now)) return null;

  return {
    deadline,
    count: streak.currentStreak,
    atRisk: last !== localDate(now),
  };
}

const HOUR = 60 * 60 * 1000;

/** Escalating, relative to the deadline. The last one is the morning after —
 *  it only survives if the user never came back to reschedule it. */
const ALERTS: {
  offset: number;
  title: (n: number) => string;
  body: (n: number) => string;
}[] = [
  {
    offset: -4 * HOUR,
    title: (n) => `🔥 Your ${n}-day streak is on the line`,
    body: () => "4 hours left today. One snippet keeps it alive.",
  },
  {
    offset: -2 * HOUR,
    title: () => "⏳ 2 hours left to save your streak",
    body: (n) => `${n} days of practice end at midnight unless you show up.`,
  },
  {
    offset: -1 * HOUR,
    title: () => "🚨 1 hour until your streak resets",
    body: (n) =>
      `Your ${n}-day streak hits zero at midnight. It takes a minute.`,
  },
  {
    offset: -15 * 60 * 1000,
    title: () => "🚨 15 minutes left!",
    body: (n) => `Last call — your ${n}-day streak is about to be gone.`,
  },
  {
    offset: 9 * HOUR,
    title: (n) => `💔 Your ${n}-day streak ended`,
    body: () => "Start a new one today. Day one is the easiest to win back.",
  },
];

const ID = (i: number) => `streak-alert-${i}`;

export async function syncStreakAlerts(
  target: StreakDeadline | null,
  enabled: boolean,
): Promise<void> {
  if (Platform.OS === "web") return;

  await Promise.all(
    ALERTS.map((_, i) =>
      Notifications.cancelScheduledNotificationAsync(ID(i)).catch(() => {}),
    ),
  );

  if (!target || !enabled) return;
  if (!(await ensureNotificationPermission())) return;

  const now = Date.now();
  await Promise.all(
    ALERTS.map(async (alert, i) => {
      const at = target.deadline.getTime() + alert.offset;
      if (at <= now) return;
      await Notifications.scheduleNotificationAsync({
        identifier: ID(i),
        content: {
          title: alert.title(target.count),
          body: alert.body(target.count),
          sound: true,
          data: { url: "sailors://daily-practice" },
          interruptionLevel: "timeSensitive",
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(at),
        },
      });
    }),
  );
}

/**
 * Re-read the streak from the server.
 *
 * The deadline is derived entirely from `lastCompletedDate`, so a cached
 * streak that is a day stale schedules the alarms for the wrong night — and
 * the cache is exactly what a warm resume has. The daily-practice flow is the
 * only other thing that fetches this, and only when one of its screens mounts,
 * which a user who just opens the app and looks at home never does.
 *
 * Failure is silent on purpose: offline, the cached streak is still the best
 * guess available and the alarms already scheduled from it are still the best
 * schedule available.
 */
let refreshing = false;

async function refreshStreak(): Promise<void> {
  if (refreshing) return;
  // A simulated streak is the dev section's whole point; a read here would
  // answer about the real one and wipe the state someone is looking at.
  if (useDailyStore.getState().streak?.simulated) return;

  refreshing = true;
  try {
    const fresh = await dailyPracticeService.getStreak(localDate());
    // Writing it is all that is needed — the subscription below reschedules,
    // and the widget sync picks it up too.
    useDailyStore.getState().setStreak(fresh);
  } catch {
    // Offline, signed out, or the endpoint is down. The cache stands.
  } finally {
    refreshing = false;
  }
}

/**
 * Keep the alarms in step with the cached streak and the reminder toggle, for
 * the life of the app. Keyed on what actually changes the schedule, so the
 * store's other writes don't churn the OS queue.
 */
export function startStreakAlertSync(): () => void {
  let previous = "";

  const sync = () => {
    const { streak, pendingCompleteDate } = useDailyStore.getState();
    const enabled =
      usePreferenceStore.getState().preferences.practiceRemindersEnabled;
    const target = streakDeadline(streak, pendingCompleteDate);

    const key = `${target?.deadline.getTime()}|${target?.count}|${enabled}`;
    if (key === previous) return;
    previous = key;
    void syncStreakAlerts(target, enabled);
  };

  sync();
  const stopDaily = useDailyStore.subscribe(sync);
  const stopPrefs = usePreferenceStore.subscribe(sync);

  /**
   * Every foreground, in this order.
   *
   * `sync()` first, from the cache, because it costs nothing and it is what
   * catches a day having rolled over while the app was away: the deadline is
   * computed against `now`, so last night's alarms are cancelled the moment
   * the app comes back rather than waiting for a fetch that may never land.
   * Then the read, which reschedules through the subscription if the server
   * disagrees with what we had.
   */
  const appState = AppState.addEventListener("change", (status) => {
    if (status !== "active") return;
    sync();
    void refreshStreak();
  });

  return () => {
    stopDaily();
    stopPrefs();
    appState.remove();
  };
}
