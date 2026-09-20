import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

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
          data: { url: "sailor://daily-practice" },
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
  return () => {
    stopDaily();
    stopPrefs();
  };
}
