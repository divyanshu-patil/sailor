import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/appearance.service", () => ({
  appearanceService: { getOptions: vi.fn() },
}));
vi.mock("@/services/preferences.service", () => ({
  preferencesService: { getPreferences: vi.fn() },
}));

import { appearanceService } from "@/services/appearance.service";
import { appearanceService as debugAppearance } from "@/services/appearance.debug.service";
import {
  syncAppearanceOptions,
  syncAppearanceOptionsOnce,
} from "@/services/appearance-sync.service";
import { debugService } from "@/services/debug.service";
import { preferencesService as debugPreferences } from "@/services/preferences.debug.service";
import { preferencesService } from "@/services/preferences.service";
import {
  syncPreferences,
  syncPreferencesOnce,
} from "@/services/preferences-sync.service";
import { userService as debugUser } from "@/services/user.debug.service";
import { defaultPreferences, usePreferenceStore } from "@/store/preference-store";
import { clearAppStorage } from "@/utils/dev-tools";
import { useAppUserStore } from "@/store/app-user.store";

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  usePreferenceStore.getState().resetPreferences();
});

describe("debugService", () => {
  it("logs with and without data, and warns", () => {
    debugService.log("s", "m");
    debugService.log("s", "m", { a: 1 });
    debugService.warn("s", "w");
    debugService.warn("s", "w", 1);
    expect(console.log).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenCalledTimes(2);
  });

  it("is silent in release builds", async () => {
    const flags = globalThis as { __DEV__?: boolean };
    flags.__DEV__ = false;
    vi.resetModules();
    const { debugService: release } = await import("@/services/debug.service");
    release.log("s", "m");
    release.warn("s", "w");
    expect(console.log).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    flags.__DEV__ = true;
  });
});

describe("appearance sync", () => {
  const options = [
    { id: "ocean", name: "Ocean", hex: "#1" },
    { id: "new", name: "New", hex: "#2" },
  ];

  it("adopts the server's list and logs the difference", async () => {
    vi.mocked(appearanceService.getOptions).mockResolvedValueOnce(options);
    await syncAppearanceOptions();
    expect(usePreferenceStore.getState().appearanceOptions).toEqual(options);
    expect(usePreferenceStore.getState().preferences.appearance.id).toBe("ocean");
  });

  it("stays quiet when nothing changed", async () => {
    usePreferenceStore.getState().setAppearanceOptions(options);
    vi.mocked(appearanceService.getOptions).mockResolvedValueOnce(options);
    await syncAppearanceOptions();
    expect(console.log).not.toHaveBeenCalled();
  });

  it("falls back when the chosen appearance was withdrawn", async () => {
    vi.mocked(appearanceService.getOptions).mockResolvedValueOnce([options[1]]);
    await syncAppearanceOptions();
    expect(usePreferenceStore.getState().preferences.appearance.id).toBe("new");

    usePreferenceStore.getState().resetPreferences();
    vi.mocked(appearanceService.getOptions).mockResolvedValueOnce([]);
    await syncAppearanceOptions();
    expect(usePreferenceStore.getState().preferences.appearance).toEqual(
      defaultPreferences.appearance,
    );
  });

  it("warns and keeps local options on failure; syncs once per session", async () => {
    vi.mocked(appearanceService.getOptions).mockRejectedValue(new Error("x"));
    await syncAppearanceOptions();
    expect(console.warn).toHaveBeenCalled();
    syncAppearanceOptionsOnce();
    syncAppearanceOptionsOnce();
    await Promise.resolve();
    expect(appearanceService.getOptions).toHaveBeenCalledTimes(2);
  });
});

describe("preferences sync", () => {
  it("adopts the server's preferences but keeps the device-only ones", async () => {
    usePreferenceStore.getState().setPreferences({ streakWidgetColor: "#000" });
    vi.mocked(preferencesService.getPreferences).mockResolvedValueOnce({
      ...defaultPreferences,
      defaultMood: "calm",
      streakWidgetColor: "#FFF",
    } as never);
    await syncPreferences();
    expect(usePreferenceStore.getState().preferences).toMatchObject({
      defaultMood: "calm",
      streakWidgetColor: "#000",
    });
  });

  it("warns on failure, and the fire-and-forget wrapper calls through", async () => {
    vi.mocked(preferencesService.getPreferences).mockRejectedValue(new Error("x"));
    await syncPreferences();
    syncPreferencesOnce();
    await Promise.resolve();
    expect(console.warn).toHaveBeenCalled();
  });
});

describe("debug services with simulated latency", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("appearance options", async () => {
    const pending = debugAppearance.getOptions();
    await vi.advanceTimersByTimeAsync(7000);
    expect((await pending).length).toBeGreaterThan(0);
  });

  it("preferences read and write the store", async () => {
    const read = debugPreferences.getPreferences();
    await vi.advanceTimersByTimeAsync(300);
    expect((await read).defaultMood).toBe(defaultPreferences.defaultMood);
    const write = debugPreferences.updatePreferences({ defaultMood: "playful" });
    await vi.advanceTimersByTimeAsync(300);
    expect((await write).defaultMood).toBe("playful");
    expect(usePreferenceStore.getState().preferences.defaultMood).toBe("playful");
  });

  it("user profile until the account is deleted", async () => {
    const get = debugUser.getProfile();
    await vi.advanceTimersByTimeAsync(1000);
    expect((await get).id).toBe("debug-user-1");
    const update = debugUser.updateProfile({ nickname: "x".repeat(40) });
    await vi.advanceTimersByTimeAsync(1000);
    expect((await update).nickname).toHaveLength(30);
    const del = debugUser.deleteAccount();
    await vi.advanceTimersByTimeAsync(1000);
    await del;
    await expect(debugUser.getProfile()).rejects.toThrow(/deleted/);
    await expect(debugUser.updateProfile({})).rejects.toThrow(/deleted/);
  });
});

describe("dev tools", () => {
  it("clears every onboarding and profile store", async () => {
    useAppUserStore.getState().setAppUser({ id: "1" } as never);
    await expect(clearAppStorage()).resolves.toBe(true);
    expect(useAppUserStore.getState()).toMatchObject({ appUser: null, _hasHydrated: true });
  });

  it("reports a failure instead of throwing", async () => {
    vi.spyOn(useAppUserStore.persist, "clearStorage").mockImplementationOnce(() => {
      throw new Error("x");
    });
    await expect(clearAppStorage()).resolves.toBe(false);
  });
});
