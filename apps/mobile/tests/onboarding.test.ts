import { describe, expect, it, vi } from "vitest";

import {
  BAND,
  COUNT,
  CROSSING,
  angleOf,
  fromSelection,
  HOURS,
  indexAt,
  joinTime,
  MINUTES,
  OVERLAP,
  rotationFor,
  splitTime,
  STEP,
} from "@/screens/onboarding/components/dial-math";
import {
  ASK_CLEARANCE,
  CONTINUE_CLEARANCE,
} from "@/screens/onboarding/config/footer";
import {
  FIRST_STEP_ID,
  nextStepId,
  ONBOARDING_STEPS,
  ONBOARDING_TOTAL_STEPS,
  progressForStep,
  stepIndex,
} from "@/screens/onboarding/config/steps";
import {
  DECK_HOLD_MS,
  DEMO_STAGES,
  footerFor,
  SCRIPT_HOLD_MS,
} from "@/screens/onboarding/demo/demo-footer";
import {
  reconcile,
  runReconcileSelfCheck,
} from "@/screens/onboarding/lib/reconcile";
import type { OnboardingState } from "@/types/onboarding";

describe("flow config", () => {
  it("orders the steps, demo between thank-you and notifications", () => {
    const ids = ONBOARDING_STEPS.map((s) => s.id);
    expect(ids[0]).toBe(FIRST_STEP_ID);
    expect(ids.indexOf("script_demo")).toBe(ids.indexOf("thank_you") + 1);
    expect(ids.indexOf("notifications")).toBe(ids.indexOf("script_demo") + 1);
    expect(ids.at(-1)).toBe("reminder_time");
  });

  it("finds indices and the next step", () => {
    expect(stepIndex(null)).toBe(-1);
    expect(stepIndex("gender")).toBe(1);
    expect(nextStepId("profile_identity")).toBe("gender");
    expect(nextStepId("reminder_time")).toBeNull();
    // An id the config doesn't know has no next.
    expect(nextStepId("nope" as never)).toBeNull();
  });

  it("measures progress against the planned length", () => {
    const total = Math.max(ONBOARDING_TOTAL_STEPS, ONBOARDING_STEPS.length);
    expect(progressForStep(null)).toBe(1);
    expect(progressForStep("profile_identity")).toBe(1 / total);
    expect(progressForStep("nope" as never)).toBe(0);
  });

  it("footer clearances fit a pill and a pair of pills", () => {
    expect(ASK_CLEARANCE).toBeGreaterThan(CONTINUE_CLEARANCE);
  });
});

describe("demo footer", () => {
  const base = {
    selected: false,
    scriptPhase: "generating" as const,
    deckPhase: "generating" as const,
    focused: false,
  };

  it("walks five stages with short holds", () => {
    expect(DEMO_STAGES).toEqual(["pick", "delivery", "output", "script", "deck"]);
    expect(SCRIPT_HOLD_MS).toBeGreaterThan(DECK_HOLD_MS);
  });

  it("gates the brief on a selection, with no way to skip", () => {
    expect(footerFor("pick", base)).toEqual({
      primary: "Use this brief",
      enabled: false,
      hidden: false,
    });
    expect(footerFor("pick", { ...base, selected: true }).enabled).toBe(true);
  });

  it("hides, with the progress bar, while a dial or card has the screen", () => {
    expect(footerFor("delivery", { ...base, focused: true })).toMatchObject({
      primary: "Next",
      hidden: true,
      selecting: true,
    });
    expect(footerFor("output", { ...base, focused: true }).selecting).toBe(true);
    expect(footerFor("output", base)).toMatchObject({
      primary: "Generate script",
      enabled: true,
      selecting: false,
    });
    // The open deck hides the footer but keeps the progress bar.
    expect(
      footerFor("deck", { ...base, deckPhase: "completed", focused: true }).selecting,
    ).toBeUndefined();
  });

  it("gives the loading screen the whole screen, then offers the next step", () => {
    expect(footerFor("script", base)).toMatchObject({ enabled: false, hidden: true });
    expect(
      footerFor("script", { ...base, scriptPhase: "completed" }),
    ).toMatchObject({ primary: "Make my deck", enabled: true, hidden: false });
    expect(footerFor("deck", base)).toMatchObject({ enabled: false, hidden: true });
    expect(footerFor("deck", { ...base, deckPhase: "completed" })).toMatchObject({
      primary: "Continue",
      enabled: true,
      hidden: false,
    });
    // The deck opened to its cards takes the screen too.
    expect(
      footerFor("deck", { ...base, deckPhase: "completed", focused: true }).hidden,
    ).toBe(true);
  });
});

describe("dial math", () => {
  it("labels twelve hours and twelve five-minute marks", () => {
    expect(COUNT).toBe(12);
    expect(HOURS[0]).toBe("01");
    expect(HOURS[11]).toBe("12");
    expect(MINUTES[11]).toBe("55");
    expect(CROSSING).toBeGreaterThan(0);
    expect(OVERLAP).toBeGreaterThan(BAND / 2);
  });

  it.each([
    ["00:00", { hourIndex: 11, minuteIndex: 0, period: "AM" }],
    ["12:30", { hourIndex: 11, minuteIndex: 6, period: "PM" }],
    ["18:07", { hourIndex: 5, minuteIndex: 1, period: "PM" }],
    ["09:58", { hourIndex: 8, minuteIndex: 0, period: "AM" }],
    ["bad", { hourIndex: 5, minuteIndex: 0, period: "PM" }],
    ["-1:00", { hourIndex: 10, minuteIndex: 0, period: "PM" }],
  ])("splits %s", (time, parts) => {
    expect(splitTime(time)).toEqual(parts);
  });

  it("joins back to 24h and round-trips", () => {
    expect(joinTime(11, 0, "AM")).toBe("00:00");
    expect(joinTime(11, 6, "PM")).toBe("12:30");
    expect(joinTime(5, 1, "PM")).toBe("18:05");
    for (const time of ["00:00", "07:35", "12:00", "23:55"]) {
      const { hourIndex, minuteIndex, period } = splitTime(time);
      expect(joinTime(hourIndex, minuteIndex, period)).toBe(time);
    }
  });

  it("places values so the selection faces the centre", () => {
    expect(angleOf("left", 0, 0)).toBe(0);
    expect(angleOf("right", 0, 0)).toBe(Math.PI);
    expect(angleOf("left", 1, 0)).toBeCloseTo(-STEP);
    expect(angleOf("right", 1, 0)).toBeCloseTo(Math.PI + STEP);
  });

  it("reads the value a rotation lands on, wrapping both ways", () => {
    expect(indexAt("left", 0)).toBe(0);
    expect(indexAt("left", 3 * STEP)).toBe(3);
    expect(indexAt("left", -STEP)).toBe(11);
    expect(indexAt("right", -2 * STEP)).toBe(2);
    expect(indexAt("right", STEP)).toBe(11);
  });

  it("picks the rotation for a value nearest the current one", () => {
    const near = 4 * Math.PI;
    const left = rotationFor("left", 2, near);
    expect(indexAt("left", left)).toBe(2);
    expect(Math.abs(left - near)).toBeLessThanOrEqual(Math.PI);
    const right = rotationFor("right", 2, 0);
    expect(indexAt("right", right)).toBe(2);
  });

  it("measures signed distance from the selection", () => {
    expect(fromSelection("left", 0)).toBe(0);
    expect(fromSelection("left", 2 * Math.PI + 0.1)).toBeCloseTo(0.1);
    expect(fromSelection("right", Math.PI - 0.2)).toBeCloseTo(-0.2);
  });
});

describe("reconcile", () => {
  const state = (over: Partial<OnboardingState> = {}): OnboardingState => ({
    userId: "u",
    flowVersion: "2026-09",
    status: "in_progress",
    currentStepId: "gender",
    data: {},
    completedSteps: [],
    lastUpdatedAt: "2026-09-23T10:00:00.000Z",
    completedAt: null,
    ...over,
  });

  it("passes its own self-check", () => {
    expect(() => runReconcileSelfCheck()).not.toThrow();
  });

  it("only self-checks at import in dev builds", async () => {
    const flags = globalThis as { __DEV__?: boolean };
    flags.__DEV__ = false;
    vi.resetModules();
    await expect(
      import("@/screens/onboarding/lib/reconcile"),
    ).resolves.toBeTruthy();
    flags.__DEV__ = true;
  });

  it("prefers the server when the local timestamp is unreadable", () => {
    expect(
      reconcile(state({ lastUpdatedAt: "garbage" }), state()),
    ).toEqual({ action: "use_server", needsServerSync: false });
  });

  it("both completed falls back to recency", () => {
    const done = { status: "completed" as const, currentStepId: null };
    expect(
      reconcile(
        state({ ...done, lastUpdatedAt: "2026-09-24T00:00:00.000Z" }),
        state(done),
      ).action,
    ).toBe("use_local");
  });
});
