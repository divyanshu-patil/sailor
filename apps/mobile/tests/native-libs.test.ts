import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Native modules, faked just far enough to watch what the libs ask of them.
// ---------------------------------------------------------------------------

const notifications = vi.hoisted(() => ({
  setNotificationHandler: vi.fn(),
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  cancelScheduledNotificationAsync: vi.fn(),
  scheduleNotificationAsync: vi.fn(),
  SchedulableTriggerInputTypes: { DAILY: "daily", DATE: "date" },
}));
vi.mock("expo-notifications", () => notifications);

const pulsar = vi.hoisted(() => {
  const played: string[] = [];
  return {
    played,
    // Any preset name plays, and is recorded by name.
    Presets: new Proxy({}, { get: (_, name: string) => () => void played.push(name) }),
    Settings: { enableSound: vi.fn(), preloadPresets: vi.fn(), enableHaptics: vi.fn() },
  };
});
vi.mock("react-native-pulsar", () => ({ Presets: pulsar.Presets, Settings: pulsar.Settings }));

/** expo-file-system over two in-memory tables: file uri → size, and dir uris. */
const fs = vi.hoisted(() => {
  const files = new Map<string, number>();
  const dirs = new Set<string>();
  const join = (parts: unknown[]) =>
    parts.map((p) => (typeof p === "string" ? p : (p as { uri: string }).uri)).join("/");
  const inside = (dir: string) => [...files.keys()].filter((k) => k.startsWith(`${dir}/`));

  class Directory {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    get exists() {
      return dirs.has(this.uri);
    }
    get size() {
      return inside(this.uri).reduce((n, k) => n + files.get(k)!, 0);
    }
    create() {
      dirs.add(this.uri);
    }
    delete() {
      dirs.delete(this.uri);
      inside(this.uri).forEach((k) => files.delete(k));
    }
  }
  class File {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    get exists() {
      return files.has(this.uri);
    }
    delete() {
      files.delete(this.uri);
    }
    copySync(destination: File) {
      files.set(destination.uri, files.get(this.uri) ?? 1);
    }
    static downloadFileAsync = vi.fn(async (_url: string, destination: File, _options?: object) => {
      files.set(destination.uri, 100);
      return destination;
    });
  }
  return { files, dirs, Directory, File };
});
vi.mock("expo-file-system", () => ({
  Directory: fs.Directory,
  File: fs.File,
  Paths: { cache: "cache" },
}));

const widgets = vi.hoisted(() => ({ dir: "group" as string | null }));
vi.mock("expo-widgets", () => ({
  get widgetsDirectory() {
    return widgets.dir;
  },
}));
const assets = vi.hoisted(() => ({ loadAsync: vi.fn() }));
vi.mock("expo-asset", () => ({ Asset: assets }));

vi.mock("expo-router", () => ({ router: { dismissTo: vi.fn() } }));
vi.mock("@/services/script.service", () => ({ scriptService: { cancel: vi.fn() } }));
vi.mock("@/services/daily-practice.service", () => ({
  dailyPracticeService: { getStreak: vi.fn() },
}));

import { router } from "expo-router";
import { AppState, Platform } from "react-native";

import { exitToHome } from "@/screens/daily-practice/exit";
import { dailyPracticeService } from "@/services/daily-practice.service";
import { scriptService } from "@/services/script.service";
import { useAppUserStore } from "@/store/app-user.store";
import { useDailyStore } from "@/store/daily-store";
import { usePreferenceStore } from "@/store/preference-store";
import { localDate, type StreakState } from "@/types/daily";
import {
  cacheAudio,
  cacheLocalAudio,
  clearAudioCache,
  deleteCachedAudio,
  getAudioCacheSizeBytes,
  getCachedAudioUri,
} from "@/utils/audio-cache";
import { clearAllCache, formatBytes, getCacheSizeBytes } from "@/utils/cache";
import {
  ensureNotificationPermission,
  startReminderSync,
  syncDailyReminder,
} from "@/lib/daily-reminder";
import {
  cancelActiveGeneration,
  getActiveGenerationId,
  registerActiveGeneration,
  releaseActiveGeneration,
  startGenerationLifecycleWatch,
} from "@/lib/generation-guard";
import { haptics, playCardHaptic, playSpeedHaptic, startHapticsSync, weight } from "@/lib/haptics";
import { STREAK_ALERTS } from "@/lib/notification-copy";
import { startStreakAlertSync, streakDeadline, syncStreakAlerts } from "@/lib/streak-alarm";
import { primeWidgetAssets, widgetArtUri } from "@/lib/widget-assets";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** The listener the lib under test most recently handed AppState. */
const lastAppStateListener = () =>
  vi.mocked(AppState.addEventListener).mock.lastCall![1] as (state: string) => void;

const streak = (over: Partial<StreakState> = {}): StreakState => ({
  currentStreak: 3,
  longestStreak: 5,
  lastCompletedDate: null,
  completedToday: false,
  ...over,
});

beforeEach(() => {
  notifications.getPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
  notifications.requestPermissionsAsync.mockResolvedValue({ granted: true });
  notifications.cancelScheduledNotificationAsync.mockResolvedValue(undefined);
  notifications.scheduleNotificationAsync.mockResolvedValue("id");
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  Platform.OS = "ios";
  usePreferenceStore.getState().resetPreferences();
  useDailyStore.setState({ streak: null, pendingCompleteDate: null, completedDays: [] });
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("generation guard", () => {
  it("tracks the one running generation", () => {
    expect(getActiveGenerationId()).toBeNull();
    registerActiveGeneration("g1");
    expect(getActiveGenerationId()).toBe("g1");
    releaseActiveGeneration("someone-else");
    expect(getActiveGenerationId()).toBe("g1");
    releaseActiveGeneration();
    expect(getActiveGenerationId()).toBeNull();
  });

  it("cancels once, and shrugs off a failed cancel", async () => {
    await cancelActiveGeneration("nothing running");
    expect(scriptService.cancel).not.toHaveBeenCalled();

    registerActiveGeneration("g2");
    vi.mocked(scriptService.cancel).mockRejectedValueOnce(new Error("offline"));
    await Promise.all([cancelActiveGeneration("home"), cancelActiveGeneration("background")]);
    expect(scriptService.cancel).toHaveBeenCalledOnce();
    expect(console.log).toHaveBeenCalledWith("[generation-guard] cancel failed (home)", "g2");
  });

  it("cancels on background, not on inactive, and subscribes once", async () => {
    const stop = startGenerationLifecycleWatch();
    const listener = lastAppStateListener();
    const again = startGenerationLifecycleWatch();
    expect(AppState.addEventListener).toHaveBeenCalledOnce();

    registerActiveGeneration("g3");
    listener("inactive");
    expect(scriptService.cancel).not.toHaveBeenCalled();
    vi.mocked(scriptService.cancel).mockResolvedValueOnce(undefined as never);
    listener("background");
    await flush();
    expect(scriptService.cancel).toHaveBeenCalledWith("g3");

    again();
    stop();
    startGenerationLifecycleWatch()();
    expect(AppState.addEventListener).toHaveBeenCalledTimes(2);
  });
});

describe("daily reminder", () => {
  it("shows the reminder in the foreground", async () => {
    // Installed when the module loaded; clearAllMocks has wiped the call since,
    // so load a fresh copy to see it.
    vi.resetModules();
    const fresh = await import("expo-notifications");
    await import("@/lib/daily-reminder");
    const handler = vi.mocked(fresh.setNotificationHandler).mock.lastCall![0]!;
    await expect(handler.handleNotification({} as never)).resolves.toMatchObject({
      shouldShowBanner: true,
      shouldPlaySound: false,
    });
  });

  it("asks for permission only while it can", async () => {
    await expect(ensureNotificationPermission()).resolves.toBe(true);
    notifications.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false });
    await expect(ensureNotificationPermission()).resolves.toBe(false);
    notifications.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });
    notifications.requestPermissionsAsync.mockResolvedValue({ granted: false });
    await expect(ensureNotificationPermission()).resolves.toBe(false);
    expect(notifications.requestPermissionsAsync).toHaveBeenCalledOnce();
  });

  it("schedules a month of dated reminders at the chosen time, each its own line", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // Noon: 07:30 has passed today, so the month starts tomorrow.
    vi.setSystemTime(new Date(2026, 8, 20, 12));
    notifications.cancelScheduledNotificationAsync.mockRejectedValueOnce(new Error("none"));
    await expect(syncDailyReminder(true, "07:30")).resolves.toBe(true);

    // The old repeating reminder is cancelled along with the dated ones.
    expect(notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith("daily-practice-reminder");
    const requests = notifications.scheduleNotificationAsync.mock.calls.map(([r]) => r);
    expect(requests).toHaveLength(30);
    expect(requests[0]).toMatchObject({
      identifier: "daily-practice-reminder-0",
      content: { data: { url: "sailors://daily-practice" } },
      trigger: { type: "date", date: new Date(2026, 8, 21, 7, 30) },
    });
    expect(requests[29].trigger.date).toEqual(new Date(2026, 9, 20, 7, 30));
    // Consecutive evenings don't say the same thing.
    expect(new Set(requests.slice(0, 7).map((r) => r.content.title)).size).toBe(7);

    // An unreadable time falls back to 18:00 — still ahead at noon, so today.
    notifications.scheduleNotificationAsync.mockClear();
    await syncDailyReminder(true, "whenever");
    expect(notifications.scheduleNotificationAsync.mock.calls[0][0].trigger.date).toEqual(
      new Date(2026, 8, 20, 18, 0),
    );
    vi.useRealTimers();
  });

  it("does nothing when off, denied, or on web", async () => {
    await expect(syncDailyReminder(false, "07:30")).resolves.toBe(false);
    notifications.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false });
    await expect(syncDailyReminder(true, "07:30")).resolves.toBe(false);
    Platform.OS = "web";
    await expect(syncDailyReminder(true, "07:30")).resolves.toBe(false);
    expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("follows the preference store, ignoring unrelated writes", async () => {
    const stop = startReminderSync();
    await flush();
    expect(notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(30);

    usePreferenceStore.getState().setPreferences({ emotionHapticsEnabled: false });
    await flush();
    expect(notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(30);

    usePreferenceStore.getState().setPreferences({ practiceReminderTime: "06:15" });
    await flush();
    expect(notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(60);
    const date: Date = notifications.scheduleNotificationAsync.mock.lastCall![0].trigger.date;
    expect([date.getHours(), date.getMinutes()]).toEqual([6, 15]);
    stop();
  });
});

describe("streak alarm", () => {
  const now = new Date(2026, 8, 20, 12);

  it("knows when a streak dies", () => {
    expect(streakDeadline(null, null, now)).toBeNull();
    expect(streakDeadline(streak({ currentStreak: 0 }), null, now)).toBeNull();
    expect(streakDeadline(streak(), null, now)).toBeNull();
    // Practised two days ago: the grace day has ended.
    expect(streakDeadline(streak({ lastCompletedDate: "2026-09-18" }), null, now)).toBeNull();

    const yesterday = streakDeadline(streak({ lastCompletedDate: "2026-09-19" }), null, now)!;
    expect(yesterday).toEqual({ deadline: new Date(2026, 8, 21), count: 3, atRisk: true });

    // A completion queued offline counts as today's practice.
    const queued = streakDeadline(streak({ lastCompletedDate: "2026-09-19" }), "2026-09-20", now)!;
    expect(queued).toMatchObject({ deadline: new Date(2026, 8, 22), atRisk: false });
  });

  it("re-arms only the alerts still ahead", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // 22:30 — the 4h and 2h warnings have already passed.
    vi.setSystemTime(new Date(2026, 8, 20, 22, 30));
    notifications.cancelScheduledNotificationAsync.mockRejectedValueOnce(new Error("none"));
    await syncStreakAlerts({ deadline: new Date(2026, 8, 21), count: 4, atRisk: true }, true);

    expect(notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(STREAK_ALERTS.length);
    const scheduled = notifications.scheduleNotificationAsync.mock.calls.map(([r]) => r.identifier);
    expect(scheduled).toEqual(["streak-alert-2", "streak-alert-3", "streak-alert-4"]);
    expect(notifications.scheduleNotificationAsync.mock.calls[0][0].content).toMatchObject({
      interruptionLevel: "timeSensitive",
      data: { url: "sailors://daily-practice" },
    });
  });

  it("only cancels when there is nothing to arm", async () => {
    const target = { deadline: new Date(Date.now() + 86_400_000), count: 2, atRisk: true };
    await syncStreakAlerts(null, true);
    await syncStreakAlerts(target, false);
    notifications.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false });
    await syncStreakAlerts(target, true);
    expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();

    Platform.OS = "web";
    notifications.cancelScheduledNotificationAsync.mockClear();
    await syncStreakAlerts(target, true);
    expect(notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });

  it("reschedules on streak and toggle changes, and refreshes on foreground", async () => {
    const stop = startStreakAlertSync();
    await flush();
    const cancels = () => notifications.cancelScheduledNotificationAsync.mock.calls.length;
    expect(cancels()).toBe(STREAK_ALERTS.length);

    // Unrelated preference: same key, no churn.
    usePreferenceStore.getState().setPreferences({ emotionHapticsEnabled: false });
    await flush();
    expect(cancels()).toBe(STREAK_ALERTS.length);

    usePreferenceStore.getState().setPreferences({ practiceRemindersEnabled: false });
    await flush();
    expect(cancels()).toBe(STREAK_ALERTS.length * 2);

    const fresh = streak({ lastCompletedDate: localDate() });
    vi.mocked(dailyPracticeService.getStreak).mockResolvedValueOnce(fresh);
    const onAppState = lastAppStateListener();
    onAppState("background");
    onAppState("active");
    onAppState("active"); // a second foreground while the first read is in flight
    await flush();
    expect(dailyPracticeService.getStreak).toHaveBeenCalledOnce();
    expect(useDailyStore.getState().streak).toEqual(fresh);

    // Offline: the cached streak stands.
    vi.mocked(dailyPracticeService.getStreak).mockRejectedValueOnce(new Error("offline"));
    onAppState("active");
    await flush();
    expect(useDailyStore.getState().streak).toEqual(fresh);

    // A simulated streak is never overwritten by a read.
    useDailyStore.getState().setStreak(streak({ simulated: true }));
    onAppState("active");
    await flush();
    expect(dailyPracticeService.getStreak).toHaveBeenCalledTimes(2);
    stop();
  });
});

describe("haptics", () => {
  beforeEach(() => void (pulsar.played.length = 0));

  it("every named haptic plays a preset", () => {
    const all = [...Object.values(weight), ...Object.values(haptics)];
    all.forEach((play) => play());
    expect(pulsar.played).toHaveLength(all.length);
  });

  it("grades cards by tier and speeds by pace", () => {
    [-1, 0, 1, 2, 3, 4, 9].forEach(playCardHaptic);
    expect(pulsar.played).toEqual(["wisp", "wisp", "feather", "nudge", "pound", "batter", "batter"]);
    pulsar.played.length = 0;
    [0.25, 0.5, 1, 1.25, 1.5, 2, 3].forEach(playSpeedHaptic);
    expect(pulsar.played).toEqual(["wane", "feather", "nudge", "snap", "strike", "spark", "barrage"]);
  });

  it("drives Pulsar's switch from the preference", () => {
    const stop = startHapticsSync();
    expect(pulsar.Settings.enableSound).toHaveBeenCalledWith(true);
    expect(pulsar.Settings.preloadPresets).toHaveBeenCalledOnce();
    expect(pulsar.Settings.enableHaptics).toHaveBeenLastCalledWith(true);

    usePreferenceStore.getState().setPreferences({ practiceReminderTime: "07:00" });
    expect(pulsar.Settings.enableHaptics).toHaveBeenCalledOnce();
    usePreferenceStore.getState().setPreferences({ emotionHapticsEnabled: false });
    expect(pulsar.Settings.enableHaptics).toHaveBeenLastCalledWith(false);
    stop();
  });

  it("leaving daily practice goes home with a back tap", () => {
    exitToHome();
    expect(pulsar.played).toEqual(["feather"]);
    expect(router.dismissTo).toHaveBeenCalledWith("/(authenticated)/(tabs)/(home)");
  });
});

describe("audio cache", () => {
  beforeEach(() => {
    fs.files.clear();
    fs.dirs.clear();
  });

  it("downloads once and reads from disk after", async () => {
    expect(getCachedAudioUri("d1")).toBeNull();
    await expect(cacheAudio("d1", "https://s3/d1")).resolves.toBe("cache/deck-audio/d1.m4a");
    expect(fs.File.downloadFileAsync.mock.lastCall![2]).toEqual({ idempotent: true });
    expect(getCachedAudioUri("d1")).toBe("cache/deck-audio/d1.m4a");
    // The directory already exists the second time round.
    await cacheAudio("d2", "https://s3/d2");
    expect(getAudioCacheSizeBytes()).toBe(200);
  });

  it("adopts a fresh take in place of the old one", () => {
    fs.files.set("tmp/take.m4a", 7);
    expect(cacheLocalAudio("d1", "tmp/take.m4a")).toBe("cache/deck-audio/d1.m4a");
    fs.files.set("tmp/take2.m4a", 9);
    cacheLocalAudio("d1", "tmp/take2.m4a");
    expect(fs.files.get("cache/deck-audio/d1.m4a")).toBe(9);
  });

  it("deletes one recording, or all of them", async () => {
    await cacheAudio("d1", "u");
    deleteCachedAudio("d1");
    deleteCachedAudio("never-cached");
    expect(getCachedAudioUri("d1")).toBeNull();

    await cacheAudio("d2", "u");
    clearAudioCache();
    clearAudioCache();
    expect(getAudioCacheSizeBytes()).toBe(0);
  });

  it("never lets the cache fail a user action", async () => {
    await cacheAudio("d1", "u");
    vi.spyOn(fs.File.prototype, "delete").mockImplementation(() => {
      throw new Error("locked");
    });
    vi.spyOn(fs.Directory.prototype, "delete").mockImplementation(() => {
      throw new Error("locked");
    });
    vi.spyOn(fs.Directory.prototype, "size", "get").mockImplementation(() => {
      throw new Error("gone");
    });
    expect(() => deleteCachedAudio("d1")).not.toThrow();
    expect(() => clearAudioCache()).not.toThrow();
    expect(getAudioCacheSizeBytes()).toBe(0);
    expect(console.log).toHaveBeenCalledTimes(3);
  });

  it("counts a directory the OS can't size as empty", async () => {
    await cacheAudio("d1", "u");
    vi.spyOn(fs.Directory.prototype, "size", "get").mockReturnValue(undefined as never);
    expect(getAudioCacheSizeBytes()).toBe(0);
  });
});

describe("settings cache", () => {
  beforeEach(() => {
    fs.files.clear();
    fs.dirs.clear();
  });

  it("formats sizes the way Settings shows them", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(20 * 1024 * 1024)).toBe("20 MB");
    expect(formatBytes(5 * 1024 ** 4)).toBe("5120 GB");
  });

  it("counts the stores and recordings, and clears both", async () => {
    usePreferenceStore.getState().setPreferences({ practiceReminderTime: "09:00" });
    await cacheAudio("d1", "u");
    expect(getCacheSizeBytes()).toBeGreaterThan(100);

    useAppUserStore.getState().setAppUser({ id: "u1" } as never);
    clearAllCache();
    expect(getAudioCacheSizeBytes()).toBe(0);
    expect(usePreferenceStore.getState().preferences.practiceReminderTime).toBe("18:00");
    expect(useAppUserStore.getState().appUser).toBeNull();
  });
});

describe("widget art", () => {
  beforeEach(() => {
    fs.files.clear();
    fs.dirs.clear();
    widgets.dir = "group";
    assets.loadAsync.mockImplementation(async (source: string) => [{ localUri: source }]);
  });

  it("copies each image into the App Group, once per launch", async () => {
    expect(widgetArtUri("flame")).toBeUndefined();
    await primeWidgetAssets();
    expect(widgetArtUri("flame")).toBe("group/widget-flame.png");
    expect(fs.files.has("group/widget-mascot-peek-paws.png")).toBe(true);
  });

  it("skips what it can't load, and gives up without a container", async () => {
    assets.loadAsync.mockImplementation(async (source: string) => {
      if (source.endsWith("widget-flame.png")) throw new Error("missing");
      return source.endsWith("hourglass.png") ? [{ localUri: null }] : [];
    });
    fs.dirs.add("group");
    await primeWidgetAssets();
    expect(console.log).toHaveBeenCalledWith("widget art flame unavailable", expect.any(Error));

    vi.spyOn(fs.Directory.prototype, "create").mockImplementation(() => {
      throw new Error("no entitlement");
    });
    fs.dirs.clear();
    await primeWidgetAssets();
    expect(console.log).toHaveBeenCalledWith("widget asset directory unavailable", expect.any(Error));

    widgets.dir = null;
    assets.loadAsync.mockClear();
    await primeWidgetAssets();
    Platform.OS = "android";
    await primeWidgetAssets();
    expect(assets.loadAsync).not.toHaveBeenCalled();
  });
});
