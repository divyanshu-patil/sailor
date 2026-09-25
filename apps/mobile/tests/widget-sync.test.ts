import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const tiles = vi.hoisted(() => {
  const widget = () => ({ updateSnapshot: vi.fn(), updateTimeline: vi.fn(), reload: vi.fn() });
  return { practice: widget(), streak: widget(), week: widget() };
});
type Tile = typeof tiles.practice;
vi.mock("@/widgets/TodaysPracticeWidget", () => ({ TodaysPracticeWidget: tiles.practice }));
vi.mock("@/widgets/StreakWidget", () => ({ StreakWidget: tiles.streak }));
vi.mock("@/widgets/StreakWeekWidget", () => ({ StreakWeekWidget: tiles.week }));
vi.mock("@/lib/widget-assets", () => ({ widgetArtUri: vi.fn() }));
vi.mock("expo-notifications", () => ({ setNotificationHandler: vi.fn() }));

import { Platform } from "react-native";

import { widgetArtUri } from "@/lib/widget-assets";
import {
  reloadWidgets,
  resyncWidgets,
  startStreakWidgetSync,
  syncPracticeWidget,
  syncStreakWidget,
} from "@/lib/widget-sync";
import { useDailyStore } from "@/store/daily-store";
import { usePreferenceStore } from "@/store/preference-store";
import { localDate, type DailyContentUnit, type StreakState } from "@/types/daily";

const unit = (over: Partial<DailyContentUnit> = {}): DailyContentUnit =>
  ({
    id: "u1",
    date: "2026-09-18",
    situation: "sales",
    body: "Cloud computing rents you someone else's computer. You pay as you go.",
    tip: "Pause after the first line.",
    ...over,
  }) as DailyContentUnit;

const streak = (over: Partial<StreakState> = {}): StreakState => ({
  currentStreak: 3,
  longestStreak: 3,
  lastCompletedDate: localDate(),
  completedToday: true,
  ...over,
});

const snapshot = (tile: Tile) => tile.updateSnapshot.mock.lastCall![0];
const timeline = (tile: Tile) => tile.updateTimeline.mock.lastCall![0];
const fail = () => {
  throw new Error("widget runtime");
};

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.mocked(widgetArtUri).mockImplementation((name) => `group/${name}.png`);
});

afterEach(() => {
  Platform.OS = "ios";
  useDailyStore.setState({ unit: null, tomorrow: null, streak: null, pendingCompleteDate: null, completedDays: [] });
  usePreferenceStore.getState().resetPreferences();
  vi.clearAllMocks();
});

describe("practice widget", () => {
  it("pushes today, then a timeline with tomorrow", () => {
    syncPracticeWidget(unit(), unit({ id: "u2", date: "2026-09-19", situation: "mystery" as never }));
    expect(snapshot(tiles.practice)).toMatchObject({
      situationLabel: "Sales Pitch",
      oneLiner: "Cloud computing rents you someone else's computer.",
      tip: "Pause after the first line.",
      mascotUri: "group/mascot-cream.png",
    });
    expect(snapshot(tiles.practice).dateLabel).toMatch(/18/);
    const [today, tomorrow] = timeline(tiles.practice);
    expect(tomorrow.props.situationLabel).toBe("Speaking");
    expect(tomorrow.date.getHours()).toBe(0);
    expect(today.props).toEqual(snapshot(tiles.practice));
  });

  it("trims to what the tile can set, on a word boundary", () => {
    const long = "Photosynthesis turns sunlight, water and air into the sugar every plant runs on today";
    syncPracticeWidget(unit({ body: long, tip: undefined as never }), null);
    const entry = snapshot(tiles.practice);
    expect(entry.oneLiner.endsWith("…")).toBe(true);
    expect(entry.oneLiner.length).toBeLessThanOrEqual(77);
    expect(entry.oneLinerShort).toBe("Photosynthesis turns sunlight, water…");
    expect(entry.tip).toBe("");

    // No space late enough to cut on: cut mid-word rather than lose most of it.
    syncPracticeWidget(unit({ body: "Supercalifragilisticexpialidocious-and-then-some-more-words" }), null);
    expect(snapshot(tiles.practice).oneLinerShort).toBe("Supercalifragilisticexpialidocious-and-t…");
    expect(tiles.practice.updateTimeline).not.toHaveBeenCalled();
  });

  it("survives odd data and missing art", () => {
    vi.mocked(widgetArtUri).mockReturnValue(undefined);
    syncPracticeWidget(unit({ date: "not a date", body: 42 as never }), null);
    expect(snapshot(tiles.practice)).toMatchObject({ dateLabel: "", mascotUri: "", plateUri: "" });

    // The widget runtime has no locale support at all.
    vi.spyOn(Date.prototype, "toLocaleDateString").mockImplementation(fail);
    syncPracticeWidget(unit(), null);
    expect(snapshot(tiles.practice).dateLabel).toBe("");
  });

  it("keeps today's tile when the timeline fails, and stops when the snapshot does", () => {
    tiles.practice.updateTimeline.mockImplementationOnce(fail);
    syncPracticeWidget(unit(), unit());
    expect(console.log).toHaveBeenCalledWith("practice widget timeline update failed", expect.any(Error));

    tiles.practice.updateSnapshot.mockImplementationOnce(fail);
    tiles.practice.updateTimeline.mockClear();
    syncPracticeWidget(unit(), unit());
    expect(tiles.practice.updateTimeline).not.toHaveBeenCalled();
  });

  it("does nothing without a body, or off iOS", () => {
    syncPracticeWidget(null, null);
    syncPracticeWidget(unit({ body: "" }), null);
    Platform.OS = "android";
    syncPracticeWidget(unit(), null);
    expect(tiles.practice.updateSnapshot).not.toHaveBeenCalled();
  });
});

describe("streak widgets", () => {
  it("shows a live streak and its week", () => {
    syncStreakWidget(streak(), "#F4D35E");
    expect(snapshot(tiles.streak)).toMatchObject({
      streakCount: 3,
      status: "alive",
      deepLink: "sailors://daily-practice",
      accentColor: "#F4D35E",
      iconUri: "group/flame.png",
    });
    const [today, tomorrow] = timeline(tiles.week);
    expect(today.props).toMatchObject({ line1: "days", line2: "in a row!", status: "alive" });
    expect(today.props.week).toHaveLength(7);
    expect(tomorrow.date.getHours()).toBe(0);
  });

  it("words each state for what can still be done", () => {
    syncStreakWidget(streak({ currentStreak: 1, completedToday: false }), "#fff", true);
    expect(snapshot(tiles.streak).status).toBe("atRisk");
    expect(timeline(tiles.week)[0].props).toMatchObject({ line1: "day", line2: "and counting!" });

    syncStreakWidget(streak({ currentStreak: 0, canRestore: true }), "#fff");
    expect(snapshot(tiles.streak)).toMatchObject({ status: "broken", deepLink: "sailors://streak-restore" });
    expect(timeline(tiles.week)[0].props.line2).toBe("streak lost");

    syncStreakWidget(streak({ currentStreak: 0 }), "#fff");
    expect(snapshot(tiles.streak)).toMatchObject({ status: "expired", deepLink: "sailors://daily-practice" });
    expect(timeline(tiles.week)[0].props.line2).toBe("streak lost");
  });

  it("falls back cleanly when art or the widget runtime is missing", () => {
    vi.mocked(widgetArtUri).mockReturnValue(undefined);
    useDailyStore.setState({ completedDays: undefined as never });
    tiles.streak.updateSnapshot.mockImplementationOnce(fail);
    tiles.week.updateTimeline.mockImplementationOnce(fail);
    syncStreakWidget(streak(), "#fff");
    expect(console.log).toHaveBeenCalledWith("streak widget update failed", expect.any(Error));
    expect(console.log).toHaveBeenCalledWith("streak week widget update failed", expect.any(Error));

    syncStreakWidget(streak(), "#fff");
    expect(snapshot(tiles.streak)).toMatchObject({ iconUri: "", plateUri: "", mascotUri: "" });
    expect(timeline(tiles.week)[0].props).toMatchObject({ flameUri: "", pawsUri: "" });
  });

  it("stays on its placeholder without a streak, or off iOS", () => {
    syncStreakWidget(null, "#fff");
    syncStreakWidget({} as StreakState, "#fff");
    Platform.OS = "android";
    syncStreakWidget(streak(), "#fff");
    expect(tiles.streak.updateSnapshot).not.toHaveBeenCalled();
  });

  it("re-pushes on a new streak or colour, and nothing else", () => {
    const stop = startStreakWidgetSync();
    // A colour change with no streak yet has nothing to draw.
    usePreferenceStore.getState().setPreferences({ streakWidgetColor: "#000000" });
    expect(tiles.streak.updateSnapshot).not.toHaveBeenCalled();

    useDailyStore.getState().setStreak(streak({ lastCompletedDate: "2020-01-01" }));
    expect(snapshot(tiles.streak).status).toBe("alive");
    useDailyStore.getState().setPendingComplete(null);
    usePreferenceStore.getState().setPreferences({ emotionHapticsEnabled: false });
    expect(tiles.streak.updateSnapshot).toHaveBeenCalledTimes(1);

    usePreferenceStore.getState().setPreferences({ streakWidgetColor: "#123456" });
    expect(snapshot(tiles.streak).accentColor).toBe("#123456");

    // Practised yesterday, not yet today: the countdown and the tile agree.
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    useDailyStore.getState().setStreak(streak({ lastCompletedDate: localDate(yesterday), completedToday: false }));
    expect(snapshot(tiles.streak).status).toBe("atRisk");
    stop();
  });
});

describe("resync and reload", () => {
  it("re-pushes whatever the cache holds, then reloads", () => {
    resyncWidgets();
    expect(tiles.practice.updateSnapshot).not.toHaveBeenCalled();
    expect(tiles.streak.updateSnapshot).not.toHaveBeenCalled();
    expect(tiles.week.reload).toHaveBeenCalledOnce();

    useDailyStore.setState({ unit: unit(), tomorrow: null, streak: streak() });
    resyncWidgets();
    expect(tiles.practice.updateSnapshot).toHaveBeenCalledOnce();
    expect(snapshot(tiles.streak).accentColor).toBe("#F4D35E");
  });

  it("logs a failed reload, and stays out of the way off iOS", () => {
    tiles.practice.reload.mockImplementationOnce(fail);
    reloadWidgets();
    expect(console.log).toHaveBeenCalledWith("widget reload failed", expect.any(Error));

    Platform.OS = "android";
    resyncWidgets();
    reloadWidgets();
    expect(tiles.streak.reload).not.toHaveBeenCalled();
  });
});
