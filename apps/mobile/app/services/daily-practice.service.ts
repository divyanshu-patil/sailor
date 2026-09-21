import { apiClient } from "@/lib/api/client";
import { DailyContentUnit, localDate, StreakState } from "@/types/daily";

export * from "@/types/daily";

/**
 *   GET  /api/v1/daily-practice/today?local_date=YYYY-MM-DD
 *   POST /api/v1/daily-practice/complete
 *   GET  /api/v1/daily-practice/streak?local_date=YYYY-MM-DD
 *
 * Every call carries the device's local calendar date. The server has no idea
 * what timezone the caller is in, and "today" and "a day was missed" are both
 * claims about the user's calendar, not about UTC.
 */

export interface DailyToday {
  today: DailyContentUnit;
  /** Present once the server's buffer has reached tomorrow. Used only to give
   *  the widget a timeline entry for local midnight, so it flips over without
   *  the app being opened. */
  tomorrow: DailyContentUnit | null;
}

/** The one restore request that may be outstanding at a time. Module scope so
 *  it is shared by every caller, including a second mount of the same screen. */
let restoreInFlight: Promise<StreakState> | null = null;

export const dailyPracticeService = {
  getToday: async (date = localDate()): Promise<DailyToday> => {
    try {
      const response = await apiClient.get<DailyToday>(
        "/api/v1/daily-practice/today",
        { params: { local_date: date } },
      );
      return response.data;
    } catch (e: any) {
      console.log("daily today error", e.response?.data, e.response?.status);
      throw e;
    }
  },

  markComplete: async (date = localDate()): Promise<StreakState> => {
    try {
      const response = await apiClient.post<StreakState>(
        "/api/v1/daily-practice/complete",
        { localDate: date },
      );
      return response.data;
    } catch (e: any) {
      console.log("daily complete error", e.response?.data, e.response?.status);
      throw e;
    }
  },

  /**
   * Bring a lapsed streak back. 409 when this month's restore is spent, 400
   * when there is nothing to restore — both are shown, not swallowed.
   *
   * Deduplicated across the whole app, not just per screen. A restore is not
   * idempotent: the first call spends the month's allowance and the second gets
   * a 409 back, so a double tap — or two mounts of the restore screen racing
   * each other — succeeded and then immediately told the person they were out
   * of restores. Callers arriving while one is in flight join it and get the
   * same answer.
   */
  restoreStreak: (date = localDate()): Promise<StreakState> => {
    if (restoreInFlight) return restoreInFlight;

    restoreInFlight = (async () => {
      try {
        const response = await apiClient.post<StreakState>(
          "/api/v1/daily-practice/restore",
          { localDate: date },
        );
        return response.data;
      } catch (e: any) {
        console.log(
          "daily restore error",
          e.response?.data,
          e.response?.status,
        );
        throw e;
      } finally {
        restoreInFlight = null;
      }
    })();

    return restoreInFlight;
  },

  getStreak: async (date = localDate()): Promise<StreakState> => {
    try {
      const response = await apiClient.get<StreakState>(
        "/api/v1/daily-practice/streak",
        { params: { local_date: date } },
      );
      return response.data;
    } catch (e: any) {
      console.log("daily streak error", e.response?.data, e.response?.status);
      throw e;
    }
  },
};
