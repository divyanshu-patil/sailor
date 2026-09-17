import { useCallback, useEffect, useRef, useState } from "react";

import { dailyPracticeService } from "@/services/daily-practice.service";
import { useDailyStore } from "@/store/daily-store";
import { usePreferenceStore } from "@/store/preference-store";
import { DailyContentUnit, localDate, StreakState } from "@/types/daily";
import { syncPracticeWidget, syncStreakWidget } from "@/lib/widget-sync";

export interface UseDailyPracticeReturn {
  /** The cached unit if it is for today, otherwise null — a stale unit is shown
   *  while refreshing (see `isStale`) rather than presented as today's. */
  unit: DailyContentUnit | null;
  isStale: boolean;
  streak: StreakState | null;
  isLoading: boolean;
  isCompleting: boolean;
  error: string | null;
  markComplete: () => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Today's content and the streak, as one hook.
 *
 * They are one hook rather than two because nothing ever wants one without the
 * other: the screen shows both, marking complete changes both widgets, and
 * splitting them would mean two mounts each doing their own fetch of the same
 * day.
 *
 * Offline-first: the persisted cache renders immediately, the network refreshes
 * it, and a failed "complete" is queued and replayed on the next successful
 * load. The server stays the source of truth for the streak — the optimistic
 * bump below is always overwritten by whatever it returns.
 */
export function useDailyPractice(): UseDailyPracticeReturn {
  const { unit, streak, pendingCompleteDate, setContent, setStreak, setPendingComplete } =
    useDailyStore();
  const widgetColor = usePreferenceStore((s) => s.preferences.streakWidgetColor);

  const [isLoading, setIsLoading] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // One load per mount. The screen is reachable from the home screen, a widget
  // tap and a notification, and all three can land on it in quick succession.
  const hasLoadedRef = useRef(false);

  const today = localDate();
  const isStale = unit !== null && unit.date !== today;

  const applyStreak = useCallback(
    (next: StreakState) => {
      setStreak(next);
      syncStreakWidget(next, widgetColor);
    },
    [setStreak, widgetColor],
  );

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const date = localDate();

      // Replay a queued completion before reading the streak back, or the
      // streak we cache is the one from before the tap that failed offline.
      // Only today's: a tap from a day that has already passed has nothing left
      // to extend.
      const queued = useDailyStore.getState().pendingCompleteDate;
      if (queued === date) {
        try {
          applyStreak(await dailyPracticeService.markComplete(date));
          setPendingComplete(null);
        } catch {
          // Still offline. It stays queued.
        }
      } else if (queued) {
        setPendingComplete(null);
      }

      const [content, currentStreak] = await Promise.all([
        dailyPracticeService.getToday(date),
        dailyPracticeService.getStreak(date),
      ]);

      setContent(content.today, content.tomorrow);
      syncPracticeWidget(content.today, content.tomorrow);
      applyStreak(currentStreak);
    } catch (e: any) {
      // Non-fatal by design: whatever is in the cache stays on screen.
      setError(
        e?.response?.data?.detail ??
          "Couldn't reach practice. Showing what's saved.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [applyStreak, setContent, setPendingComplete]);

  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    void refresh();
  }, [refresh]);

  const markComplete = useCallback(async () => {
    const date = localDate();
    if (streak?.completedToday) return;

    setIsCompleting(true);
    // Optimistic, so the tap lands instantly. Overwritten by the server's
    // answer below, which is the one that counts.
    if (streak) {
      setStreak({ ...streak, currentStreak: streak.currentStreak + 1, completedToday: true });
    }

    try {
      applyStreak(await dailyPracticeService.markComplete(date));
      setPendingComplete(null);
    } catch {
      // Queued rather than surfaced as an error: the user did practise, and the
      // streak should survive having done it on a train.
      setPendingComplete(date);
    } finally {
      setIsCompleting(false);
    }
  }, [applyStreak, setPendingComplete, setStreak, streak]);

  return {
    unit,
    isStale,
    streak: streak
      ? { ...streak, completedToday: streak.completedToday || pendingCompleteDate === today }
      : null,
    isLoading,
    isCompleting,
    error,
    markComplete,
    refresh,
  };
}
