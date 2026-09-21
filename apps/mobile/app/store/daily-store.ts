import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { createMMKVStorage } from "@/store/mmkv.storage";
import { DailyContentUnit, StreakState } from "@/types/daily";

/**
 * The offline half of daily practice.
 *
 * Persisted so the screen and the widget can render the moment they mount, with
 * no spinner and no network: yesterday's cached unit is wrong for about a
 * second, a blank screen is wrong for as long as the connection is bad. The
 * server stays the source of truth for the streak — this is a cache in front of
 * it, plus one queued write.
 */
interface DailyStore {
  /** Last unit fetched, whatever day it was for. `unit.date` says which. */
  unit: DailyContentUnit | null;
  /** Tomorrow's unit, when the server had it. Fed to the widget's timeline. */
  tomorrow: DailyContentUnit | null;
  streak: StreakState | null;
  /**
   * A "mark as practised" tap that never reached the server, as the local date
   * it was made on. One slot, not a queue: a second tap on the same day is a
   * no-op server-side anyway, and a tap from a previous day is not something to
   * replay — the streak it would have continued has already lapsed.
   */
  pendingCompleteDate: string | null;

  setContent: (
    unit: DailyContentUnit,
    tomorrow: DailyContentUnit | null,
  ) => void;
  setStreak: (streak: StreakState) => void;
  setPendingComplete: (date: string | null) => void;
  reset: () => void;
}

export const useDailyStore = create<DailyStore>()(
  persist(
    (set) => ({
      unit: null,
      tomorrow: null,
      streak: null,
      pendingCompleteDate: null,

      setContent: (unit, tomorrow) => set({ unit, tomorrow }),
      setStreak: (streak) => set({ streak }),
      setPendingComplete: (pendingCompleteDate) => set({ pendingCompleteDate }),
      reset: () =>
        set({
          unit: null,
          tomorrow: null,
          streak: null,
          pendingCompleteDate: null,
        }),
    }),
    {
      name: "daily-store",
      storage: createJSONStorage(() => createMMKVStorage("daily-storage")),
      // Bumped whenever the cached unit's shape changes, because a persisted
      // unit is only ever as new as the build that wrote it.
      //   1: `type` (a vague subject) became `framework` + `frameworkLabel`.
      //   2: `frameworkSteps` added — units cached at v1 lack it, and the intro
      //      screen crashed on `.map` of undefined before this was bumped.
      //   3: clears a `simulated` streak written by the dev section before
      //      `partialize` below started stripping it. One of those on disk made
      //      the restore screen refuse to re-read the server on every launch,
      //      indefinitely.
      // Dropping the cache costs one screen of "no practice yet" and fixes
      // itself on the first refresh.
      version: 3,
      // A simulated streak lives for the session, never on disk. The dev
      // section writes one so the home and restore screens can be looked at in
      // a given state; persisted, it outlived the app and left the restore
      // screen refusing to re-read the server on every later launch — a dev
      // tap at lunchtime still shaping the app that evening.
      partialize: (state) => ({
        ...state,
        streak: state.streak?.simulated
          ? { ...state.streak, simulated: undefined }
          : state.streak,
      }),
      migrate: (persisted, version) => {
        if (version < 2) {
          return {
            unit: null,
            tomorrow: null,
            streak: null,
            pendingCompleteDate: null,
          };
        }
        return persisted as DailyStore;
      },
    },
  ),
);
