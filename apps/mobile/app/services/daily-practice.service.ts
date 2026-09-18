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
