import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, apiErrorMessage, setupApiAuth } from "@/lib/api/client";
import {
  DAILY_REMINDERS,
  dailyReminderFor,
  pickForDay,
  STREAK_ALERTS,
  streakAlertFor,
} from "@/lib/notification-copy";
import { mergeDays, runDates, shiftDate, weekPattern } from "@/lib/streak-days";
import { reconcile, runReconcileSelfCheck } from "@/screens/onboarding/lib/reconcile";
import { useDailyStore } from "@/store/daily-store";

describe("api client", () => {
  it("reads FastAPI's error shapes", () => {
    expect(apiErrorMessage({ response: { data: { detail: "Nope" } } })).toBe("Nope");
    expect(
      apiErrorMessage({ response: { data: { detail: { message: "Upgrade" } } } }),
    ).toBe("Upgrade");
    expect(
      apiErrorMessage({
        response: {
          data: {
            detail: [
              { loc: ["body", "description"], msg: "too short" },
              { loc: "x", msg: "bad" },
              { loc: ["body", "x"] },
              {},
            ],
          },
        },
      }),
    ).toBe("description: too short\nbad\nx: invalid");
    expect(apiErrorMessage({ message: "offline" })).toBe("offline");
    expect(apiErrorMessage({ response: { data: { detail: "" } } }, "fallback")).toBe(
      "fallback",
    );
    expect(apiErrorMessage(undefined)).toBe("Something went wrong");
    expect(apiErrorMessage({ response: { data: { detail: [] } } })).toBe(
      "Something went wrong",
    );
  });

  it("adds the bearer token when there is one", async () => {
    let token: string | null = "abc";
    setupApiAuth(async () => token);
    const interceptor = (api.interceptors.request as any).handlers.at(-1);
    const withToken = await interceptor.fulfilled({ headers: {} });
    expect(withToken.headers.Authorization).toBe("Bearer abc");
    token = null;
    const without = await interceptor.fulfilled({ headers: {} });
    expect(without.headers.Authorization).toBeUndefined();
    const noHeaders = await interceptor.fulfilled({});
    expect(noHeaders.headers).toBeUndefined();
    await expect(interceptor.rejected(new Error("x"))).rejects.toThrow("x");
  });

  it("the thin wrapper forwards every verb", async () => {
    const { apiClient } = await import("@/lib/api/client");
    for (const verb of ["get", "post", "patch", "put", "delete"] as const) {
      const spy = vi.spyOn(api, verb).mockResolvedValue({ data: verb } as never);
      await (apiClient[verb] as (...args: unknown[]) => Promise<unknown>)("/x", {});
      expect(spy).toHaveBeenCalled();
    }
  });
});

describe("env", () => {
  afterEach(() => vi.resetModules());

  it("fails loudly on a missing required variable", async () => {
    const saved = process.env.EXPO_PUBLIC_API_URL;
    Reflect.deleteProperty(process.env, "EXPO_PUBLIC_API_URL");
    vi.resetModules();
    await expect(import("@/lib/config/env")).rejects.toThrow(
      "Missing required env var: EXPO_PUBLIC_API_URL",
    );
    process.env.EXPO_PUBLIC_API_URL = saved;
  });

  it("defaults the optional keys to empty", async () => {
    vi.resetModules();
    const { ENV } = await import("@/lib/config/env");
    expect(ENV.API_URL).toBe(process.env.EXPO_PUBLIC_API_URL);
    expect(typeof ENV.SENTRY_DSN).toBe("string");
  });

  it("reads the optional keys when set", async () => {
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY = "ios";
    process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY = "android";
    process.env.EXPO_PUBLIC_SENTRY_DSN = "dsn";
    vi.resetModules();
    const { ENV } = await import("@/lib/config/env");
    expect(ENV).toMatchObject({
      REVENUECAT_IOS_API_KEY: "ios",
      REVENUECAT_ANDROID_API_KEY: "android",
      SENTRY_DSN: "dsn",
    });
    delete process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
    delete process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
  });
});

describe("notification copy", () => {
  const day = (i: number) => new Date(2026, 8, 1 + i, 18);

  it("never repeats within a run of the pool, and a date keeps its line", () => {
    const pool = ["a", "b", "c", "d", "e", "f", "g"];
    // Any window of pool.length days that starts on a run boundary is a permutation.
    const start = Math.ceil(Date.UTC(2026, 8, 1) / 86_400_000 / pool.length) * pool.length;
    const first = new Date(start * 86_400_000);
    const firstLocal = new Date(first.getUTCFullYear(), first.getUTCMonth(), first.getUTCDate());
    const run = pool.map((_, i) => {
      const d = new Date(firstLocal);
      d.setDate(d.getDate() + i);
      return pickForDay(pool, d);
    });
    expect(new Set(run).size).toBe(pool.length);
    expect(pickForDay(pool, day(3))).toBe(pickForDay(pool, day(3)));
    expect(pickForDay(pool, day(3), 7)).toBe(pickForDay(pool, day(3), 7));
  });

  it("fills the nickname, and skips lines that need one when there isn't", () => {
    const withName = Array.from({ length: DAILY_REMINDERS.length }, (_, i) =>
      dailyReminderFor(day(i), "Div"),
    );
    expect(withName.some((l) => `${l.title} ${l.body}`.includes("Div"))).toBe(true);
    for (let i = 0; i < DAILY_REMINDERS.length; i++) {
      for (const name of [null, undefined, "  "]) {
        const line = dailyReminderFor(day(i), name);
        expect(`${line.title}${line.body}`).not.toMatch(/\{|\}|undefined/);
      }
    }
  });

  it("keeps every line short enough for a lock screen", () => {
    const lines = [...DAILY_REMINDERS, ...STREAK_ALERTS.flatMap((a) => a.lines)];
    for (const line of lines) {
      expect(line.title.length).toBeLessThanOrEqual(40);
      expect(line.body.length).toBeLessThanOrEqual(90);
    }
  });

  it("puts the day count in every streak alert, rotating night to night", () => {
    STREAK_ALERTS.forEach((_, i) => {
      const nights = Array.from({ length: 4 }, (_, n) => streakAlertFor(i, 12, day(n)));
      for (const line of nights) {
        expect(`${line.title} ${line.body}`).toContain("12");
        expect(`${line.title}${line.body}`).not.toMatch(/\{|\}|undefined/);
      }
      expect(new Set(nights.map((l) => l.title)).size).toBeGreaterThan(1);
    });
  });
});

describe("streak days", () => {
  const THU = "2026-09-24";

  it("the current run, newest first", () => {
    expect(runDates({ currentStreak: 3, lastCompletedDate: THU })).toEqual([
      "2026-09-24",
      "2026-09-23",
      "2026-09-22",
    ]);
    expect(runDates({ currentStreak: 0, lastCompletedDate: THU })).toEqual([]);
    expect(runDates({ currentStreak: 5, lastCompletedDate: null })).toEqual([]);
    expect(runDates({ currentStreak: 2, lastCompletedDate: "2026-10-01" })).toEqual([
      "2026-10-01",
      "2026-09-30",
    ]);
    expect(runDates({ currentStreak: 99, lastCompletedDate: THU })).toHaveLength(14);
  });

  it("the week row", () => {
    expect(weekPattern(runDates({ currentStreak: 3, lastCompletedDate: "2026-09-23" }), THU)).toBe("DDDTFFF");
    const log = mergeDays(["2026-09-21"], { currentStreak: 2, lastCompletedDate: THU }, THU);
    expect(log).toEqual(["2026-09-21", "2026-09-23", "2026-09-24"]);
    expect(weekPattern(log, THU)).toBe("DMDDFFF");
    expect(weekPattern(runDates({ currentStreak: 30, lastCompletedDate: "2026-09-27" }), "2026-09-28")).toBe("TFFFFFF");
    expect(
      mergeDays(["2026-08-01", "2026-09-20", "2026-09-30"], { currentStreak: 0, lastCompletedDate: null }, THU),
    ).toEqual(["2026-09-20"]);
    expect(shiftDate("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("reconcile self-check", () => {
  it("throws when reconcile is wrong", () => {
    vi.spyOn(Date, "parse").mockReturnValue(Number.NaN);
    expect(() => runReconcileSelfCheck()).toThrow(/self-check failed/);
    expect(reconcile(null, null).action).toBe("start_fresh");
  });
});

describe("daily store, old caches", () => {
  it("starts a log for a cache written before the log existed", () => {
    useDailyStore.setState({ completedDays: undefined as never });
    useDailyStore.getState().setStreak({
      currentStreak: 1,
      longestStreak: 1,
      lastCompletedDate: new Date().toISOString().slice(0, 10),
      completedToday: true,
    });
    expect(Array.isArray(useDailyStore.getState().completedDays)).toBe(true);
  });
});

describe("timers", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("are faked here, for the debug services below", () => {
    expect(vi.isFakeTimers()).toBe(true);
  });
});
