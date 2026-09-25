import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/purchases", () => ({
  fetchCurrentOffering: vi.fn(),
  fetchCustomerInfo: vi.fn(),
  hasProEntitlement: vi.fn((info: { pro?: boolean } | null) => !!info?.pro),
  purchasePackage: vi.fn(),
  restorePurchases: vi.fn(),
}));

vi.mock("@/services/user.service", () => ({
  userService: { updateProfile: vi.fn() },
}));

import * as purchases from "@/lib/purchases";
import { userService } from "@/services/user.service";
import { useAppUserStore } from "@/store/app-user.store";
import { useDailyStore } from "@/store/daily-store";
import { createMMKVStorage } from "@/store/mmkv.storage";
import { useOnboardingCompletionStore } from "@/store/onboarding-completion.store";
import { useOnboardingPendingStore } from "@/store/onboarding-pending.store";
import {
  clearOnboardingProgress,
  readOnboardingProgress,
  useOnboardingProgressStore,
  writeOnboardingProgress,
} from "@/store/onboarding-progress.store";
import { defaultPreferences, usePreferenceStore } from "@/store/preference-store";
import { useProIntroStore } from "@/store/pro-intro.store";
import { useProfileSetupStore } from "@/store/profile-setup.store";
import { useScriptStore } from "@/store/script-store";
import {
  useIsPro,
  useSubscriptionReady,
  useSubscriptionStore,
} from "@/store/subscription.store";
import type { OnboardingState } from "@/types/onboarding";

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("mmkv storage adapter", () => {
  it("round-trips, removes and clears", () => {
    const s = createMMKVStorage("t1");
    expect(s.getItem("k")).toBeNull();
    s.setItem("k", JSON.stringify({ a: 1 }));
    expect(s.getItem("k")).toBe('{"a":1}');
    s.removeItem("k");
    expect(s.getItem("k")).toBeNull();
    s.setItem("k", "1");
    s.clearAll();
    expect(s.getItem("k")).toBeNull();
  });

  it("drops a corrupted value instead of handing it on", () => {
    const s = createMMKVStorage("t2");
    s.setItem("bad", "{not json");
    expect(s.getItem("bad")).toBeNull();
    expect(s.getItem("bad")).toBeNull();
  });

});

/** The persisted stores share a shape: a hydration flag, and a hydration
 *  callback with an error branch that only a broken storage can reach. */
describe.each([
  ["app-user", "@/store/app-user.store", "useAppUserStore"],
  ["onboarding-completion", "@/store/onboarding-completion.store", "useOnboardingCompletionStore"],
  ["onboarding-pending", "@/store/onboarding-pending.store", "useOnboardingPendingStore"],
  ["profile-setup", "@/store/profile-setup.store", "useProfileSetupStore"],
])("%s store hydration", (_name, path, exportName) => {
  afterEach(() => vi.doUnmock("@/store/mmkv.storage"));

  it("marks itself hydrated, and again after a rehydrate", async () => {
    vi.resetModules();
    const mod = await import(path);
    const store = mod[exportName];
    expect(store.getState()._hasHydrated).toBe(true);
    store.getState().setHasHydrated(false);
    await store.persist.rehydrate();
    expect(store.getState()._hasHydrated).toBe(true);
  });

  it("reports a hydration failure and stays unhydrated", async () => {
    vi.resetModules();
    vi.doMock("@/store/mmkv.storage", () => ({
      createMMKVStorage: () => ({
        getItem: () => "{broken",
        setItem: () => {},
        removeItem: () => {},
      }),
    }));
    const mod = await import(path);
    expect(mod[exportName].persist.hasHydrated()).toBe(false);
  });
});

describe("app-user store", () => {
  const profile = {
    id: "1",
    clerkUserId: "c",
    email: "e",
    nickname: "n",
    experienceLevel: "beginner" as const,
    profession: null,
    avatarUrl: null,
    role: "user" as const,
  };

  it("does nothing without a user", async () => {
    useAppUserStore.getState().clearAppState();
    await useAppUserStore.getState().updateAppUserProfile({ nickname: "x" });
    expect(userService.updateProfile).not.toHaveBeenCalled();
  });

  it("updates locally, sends only what changed, adopts the server's answer", async () => {
    useAppUserStore.getState().setAppUser(profile);
    vi.mocked(userService.updateProfile).mockResolvedValueOnce({
      id: "1",
      clerk_user_id: "c",
      nickname: "nick",
      experience_level: "advanced",
      profession: "tech",
      avatar_url: "a",
      role: "admin",
    } as never);
    await useAppUserStore.getState().updateAppUserProfile({
      nickname: "nick",
      experienceLevel: "advanced",
      profession: "tech",
      email: "e2",
    });
    expect(userService.updateProfile).toHaveBeenCalledWith({
      nickname: "nick",
      experience_level: "advanced",
      profession: "tech",
      email: "e2",
    });
    expect(useAppUserStore.getState().appUser).toMatchObject({ role: "admin", avatarUrl: "a" });
  });

  it("keeps the local value when the server fails, and a sign-out mid-flight wins", async () => {
    useAppUserStore.getState().setAppUser(profile);
    vi.mocked(userService.updateProfile).mockRejectedValueOnce(new Error("x"));
    await useAppUserStore.getState().updateAppUserProfile({});
    expect(useAppUserStore.getState().appUser?.nickname).toBe("n");

    vi.mocked(userService.updateProfile).mockImplementationOnce(async () => {
      useAppUserStore.getState().clearAppState();
      return {} as never;
    });
    await useAppUserStore.getState().updateAppUserProfile({ nickname: "z" });
    expect(useAppUserStore.getState().appUser).toBeNull();
  });

  it("migrates an old persisted version to a clean slate", async () => {
    vi.resetModules();
    const { createMMKVStorage: storage } = await import("@/store/mmkv.storage");
    storage("app-user-storage").setItem(
      "app-user-store",
      JSON.stringify({ state: { appUser: profile }, version: 0 }),
    );
    const { useAppUserStore: fresh } = await import("@/store/app-user.store");
    expect(fresh.getState().appUser).toBeNull();
  });
});

describe("small stores", () => {
  it("onboarding completion, pending, profile setup", () => {
    const completion = useOnboardingCompletionStore.getState();
    completion.completeOnboarding("u");
    expect(useOnboardingCompletionStore.getState().completedForUserId).toBe("u");
    completion.resetOnboardingCompletion();
    expect(useOnboardingCompletionStore.getState().completedForUserId).toBeNull();
    // The server's answer is recorded per user, in memory only.
    expect(useOnboardingCompletionStore.getState().checkedForUserId).toBeNull();
    completion.markChecked("u");
    expect(useOnboardingCompletionStore.getState().checkedForUserId).toBe("u");

    const pending = useOnboardingPendingStore.getState();
    pending.markCompleted();
    pending.requestCreateAccount();
    expect(useOnboardingPendingStore.getState()).toMatchObject({
      completed: true,
      createAccountRequested: true,
    });
    pending.consumeCreateAccountRequest();
    expect(useOnboardingPendingStore.getState().createAccountRequested).toBe(false);
    pending.reset();
    expect(useOnboardingPendingStore.getState().completed).toBe(false);

    const setup = useProfileSetupStore.getState();
    setup.completeProfileSetup("u");
    expect(useProfileSetupStore.getState().completedForUserId).toBe("u");
    setup.resetProfileSetup();
    expect(useProfileSetupStore.getState().completedForUserId).toBeNull();
  });

  it("script store", () => {
    const s = useScriptStore.getState();
    s.setResult({ generationId: "g", title: "t", script: "s" });
    s.updateScript("s2");
    expect(useScriptStore.getState()).toMatchObject({ generationId: "g", script: "s2" });
    s.reset();
    expect(useScriptStore.getState().generationId).toBeNull();
  });

  it("preferences", async () => {
    const p = usePreferenceStore.getState();
    p.setPreferences({ defaultMood: "calm" });
    p.setPreference("practiceReminderTime", "07:30");
    p.setAppearance({ id: "rust", name: "Rust", hex: "#B75C5C" });
    p.setAppearanceOptions([]);
    expect(usePreferenceStore.getState().preferences).toMatchObject({
      defaultMood: "calm",
      practiceReminderTime: "07:30",
      appearance: { id: "rust" },
    });
    await usePreferenceStore.persist.rehydrate();
    expect(usePreferenceStore.getState().appearanceOptions).toEqual([]);
    usePreferenceStore.persist.clearStorage();
    p.resetPreferences();
    expect(usePreferenceStore.getState().preferences).toEqual(defaultPreferences);
  });
});

describe("onboarding progress store", () => {
  const state = (over: Partial<OnboardingState> = {}): OnboardingState => ({
    userId: "u1",
    flowVersion: "2026-09",
    status: "in_progress",
    currentStepId: "gender",
    data: {},
    completedSteps: [],
    lastUpdatedAt: "t",
    completedAt: null,
    ...over,
  });

  beforeEach(() => useOnboardingProgressStore.getState().clearAll());

  it("hydrates nothing, then what was written", () => {
    const store = useOnboardingProgressStore;
    store.getState().hydrate("u1");
    expect(store.getState()).toMatchObject({ hydrated: true, state: null, pendingSync: false });
    store.getState().setState(state());
    store.getState().hydrate("u1");
    expect(store.getState()).toMatchObject({ state: { userId: "u1" }, pendingSync: true });
  });

  it("patches, patches data, adopts, marks synced — and ignores all of it with no state", () => {
    const store = useOnboardingProgressStore;
    store.getState().patch({ status: "completed" });
    store.getState().patchData({ nickname: "x" });
    store.getState().markSynced();
    expect(store.getState().state).toBeNull();

    store.getState().setState(state(), { sync: false });
    store.getState().patch({ currentStepId: "referral" }, { sync: false });
    expect(store.getState().pendingSync).toBe(false);
    store.getState().patch({ currentStepId: "speaking_level" });
    expect(store.getState().pendingSync).toBe(true);
    store.getState().patchData({ gender: "female" });
    expect(store.getState().state?.data).toEqual({ gender: "female" });
    store.getState().markSynced();
    expect(store.getState().pendingSync).toBe(false);
    store.getState().adoptRemote(state({ currentStepId: "thank_you" }));
    expect(readOnboardingProgress("u1")?.currentStepId).toBe("thank_you");
  });

  it("clears one scope — the current one by default — or everything", () => {
    const store = useOnboardingProgressStore;
    store.getState().setState(state());
    store.getState().clear();
    expect(readOnboardingProgress("u1")).toBeNull();
    store.getState().clear();
    writeOnboardingProgress(state({ userId: "u2" }));
    store.getState().clear("u2");
    expect(readOnboardingProgress("u2")).toBeNull();
  });

  it("the free functions read, write and clear by scope", () => {
    writeOnboardingProgress(state({ userId: "pending" }), false);
    expect(readOnboardingProgress("pending")?.userId).toBe("pending");
    clearOnboardingProgress("pending");
    expect(readOnboardingProgress("pending")).toBeNull();
  });

  it("rejects records without a user and records that won't parse", async () => {
    const storage = createMMKVStorage("onboarding-progress-storage");
    storage.setItem("onboarding:bad", JSON.stringify({ state: {} }));
    expect(readOnboardingProgress("bad")).toBeNull();

    vi.resetModules();
    vi.doMock("@/store/mmkv.storage", () => ({
      createMMKVStorage: () => ({ getItem: () => "{nope", setItem: () => {}, removeItem: () => {}, clearAll: () => {} }),
    }));
    const { readOnboardingProgress: read } = await import("@/store/onboarding-progress.store");
    expect(read("any")).toBeNull();
    vi.doUnmock("@/store/mmkv.storage");
  });
});

describe("daily store", () => {
  it("merges the streak into the per-day log, skipping simulated ones", () => {
    const s = useDailyStore.getState();
    s.reset();
    s.setStreak({
      currentStreak: 2,
      longestStreak: 2,
      lastCompletedDate: new Date().toISOString().slice(0, 10),
      completedToday: true,
    });
    const logged = useDailyStore.getState().completedDays.length;
    s.setStreak({
      currentStreak: 9,
      longestStreak: 9,
      lastCompletedDate: "2020-01-01",
      completedToday: false,
      simulated: true,
    });
    expect(useDailyStore.getState().completedDays).toHaveLength(logged);
    s.setContent({ date: "d" } as never, null);
    s.setPendingComplete("2026-09-25");
    expect(useDailyStore.getState()).toMatchObject({
      unit: { date: "d" },
      pendingCompleteDate: "2026-09-25",
    });
    s.reset();
    expect(useDailyStore.getState().streak).toBeNull();
  });

  it("strips a simulated streak from what it persists, and migrates old caches", async () => {
    const s = useDailyStore.getState();
    s.setStreak({ currentStreak: 1, longestStreak: 1, lastCompletedDate: null, completedToday: false, simulated: true });
    await useDailyStore.persist.rehydrate();
    expect(useDailyStore.getState().streak).toBeNull();
    s.setStreak({ currentStreak: 1, longestStreak: 1, lastCompletedDate: null, completedToday: false });
    await useDailyStore.persist.rehydrate();
    expect(useDailyStore.getState().streak?.currentStreak).toBe(1);

    const storage = createMMKVStorage("daily-storage");
    storage.setItem("daily-store", JSON.stringify({ state: { unit: { date: "old" } }, version: 1 }));
    await useDailyStore.persist.rehydrate();
    expect(useDailyStore.getState().unit).toBeNull();
    storage.setItem("daily-store", JSON.stringify({ state: { unit: { date: "kept" }, streak: null, tomorrow: null, pendingCompleteDate: null }, version: 2 }));
    await useDailyStore.persist.rehydrate();
    expect(useDailyStore.getState().unit).toEqual({ date: "kept" });
  });
});

describe("subscription store", () => {
  const p = vi.mocked(purchases);
  beforeEach(() => {
    useSubscriptionStore.setState({
      customerInfo: null,
      isPro: false,
      isReady: false,
      isRefreshing: false,
      offering: null,
      isLoadingOffering: false,
      isPurchasing: false,
      error: null,
    });
  });

  it("refresh applies what it gets, keeps a known state over a null", async () => {
    p.fetchCustomerInfo.mockResolvedValueOnce({ pro: true } as never);
    await useSubscriptionStore.getState().refresh(true);
    expect(useSubscriptionStore.getState()).toMatchObject({ isPro: true, isReady: true, isRefreshing: false });
    p.fetchCustomerInfo.mockResolvedValueOnce(null as never);
    await useSubscriptionStore.getState().refresh();
    expect(useSubscriptionStore.getState().isPro).toBe(true);
    useSubscriptionStore.setState({ customerInfo: null });
    p.fetchCustomerInfo.mockResolvedValueOnce(null as never);
    await useSubscriptionStore.getState().refresh();
    expect(useSubscriptionStore.getState().isPro).toBe(false);
  });

  it("loads the offering once at a time", async () => {
    p.fetchCurrentOffering.mockResolvedValueOnce({ id: "o" } as never);
    await useSubscriptionStore.getState().loadOffering();
    expect(useSubscriptionStore.getState().offering).toEqual({ id: "o" });
    useSubscriptionStore.setState({ isLoadingOffering: true });
    await useSubscriptionStore.getState().loadOffering();
    expect(p.fetchCurrentOffering).toHaveBeenCalledTimes(1);
  });

  it("purchases: success, failure, and a double tap", async () => {
    p.purchasePackage.mockResolvedValueOnce({ kind: "purchased", customerInfo: { pro: true } } as never);
    expect((await useSubscriptionStore.getState().purchase({} as never)).kind).toBe("purchased");
    expect(useSubscriptionStore.getState().isPro).toBe(true);

    p.purchasePackage.mockResolvedValueOnce({ kind: "failed", message: "card declined" } as never);
    await useSubscriptionStore.getState().purchase({} as never);
    expect(useSubscriptionStore.getState().error).toBe("card declined");
    useSubscriptionStore.getState().clearError();
    expect(useSubscriptionStore.getState().error).toBeNull();

    useSubscriptionStore.setState({ isPurchasing: true });
    expect(await useSubscriptionStore.getState().purchase({} as never)).toEqual({ kind: "cancelled" });
  });

  it("restore: nothing to restore, and a pro restore", async () => {
    p.restorePurchases.mockResolvedValueOnce(null as never);
    expect(await useSubscriptionStore.getState().restore()).toBe(false);
    expect(useSubscriptionStore.getState().error).toMatch(/restore/);
    p.restorePurchases.mockResolvedValueOnce({ pro: true } as never);
    expect(await useSubscriptionStore.getState().restore()).toBe(true);
  });

  it("selector hooks read the flags", () => {
    // Server rendering reads zustand's initial snapshot, which is what a
    // component sees on its very first render too.
    useSubscriptionStore.setState({ isPro: true, isReady: true });
    const Probe = () => `${useIsPro()}-${useSubscriptionReady()}`;
    expect(renderToString(createElement(Probe))).toBe("false-false");
  });
});

describe("pro intro", () => {
  it("is owed after a sign-in and spent once shown", () => {
    expect(useProIntroStore.getState().pending).toBe(false);
    useProIntroStore.getState().markPending();
    expect(useProIntroStore.getState().pending).toBe(true);
    useProIntroStore.getState().consume();
    expect(useProIntroStore.getState().pending).toBe(false);
  });
});
