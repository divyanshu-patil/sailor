import { describe, expect, it } from "vitest";

import {
  categoryLabel,
  categorySymbol,
  DECK_CATEGORIES,
  SUGGESTED_TAGS,
} from "@/constants/deck-categories";
import { DECK_PALETTE, paletteColorAt } from "@/constants/deck-palette";
import { DEV_MODE, DEV_TOKENS, DEV_USER } from "@/constants/dev-mode";
import { fonts } from "@/constants/fonts";
import { SocialAuthProvider } from "@/types/auth";
import { localDate } from "@/types/daily";
import {
  createInitialOnboardingState,
  ONBOARDING_FLOW_VERSION,
  PENDING_SCOPE,
} from "@/types/onboarding";
import { AUDIENCE_OPTIONS } from "@/types/presentation";
import { MOOD_OPTIONS } from "@/types/settings/preferences";
import { PROFESSION_LABELS, PROFESSIONS } from "@/types/user";

describe("types", () => {
  it("localDate formats the local calendar day, zero-padded", () => {
    expect(localDate(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
    expect(localDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("creates a fresh onboarding record", () => {
    const state = createInitialOnboardingState(PENDING_SCOPE, "gender");
    expect(state).toMatchObject({
      userId: "pending",
      flowVersion: ONBOARDING_FLOW_VERSION,
      status: "in_progress",
      currentStepId: "gender",
      data: {},
      completedSteps: [],
      completedAt: null,
    });
    expect(Number.isNaN(Date.parse(state.lastUpdatedAt))).toBe(false);
  });

  it("option tables are complete and distinct", () => {
    expect(new Set(AUDIENCE_OPTIONS.map((a) => a.value)).size).toBe(
      AUDIENCE_OPTIONS.length,
    );
    expect(MOOD_OPTIONS.map((m) => m.tag)).toContain("confident");
    expect(PROFESSIONS).toEqual(Object.keys(PROFESSION_LABELS));
    expect(Object.values(SocialAuthProvider).length).toBeGreaterThan(0);
  });
});

describe("constants", () => {
  it("looks categories up by value, with fallbacks", () => {
    const first = DECK_CATEGORIES[0];
    expect(categoryLabel(first.value)).toBe(first.label);
    expect(categorySymbol(first.value)).toBe(first.symbol);
    expect(categoryLabel("nope")).toBe("");
    expect(categoryLabel(null)).toBe("");
    expect(categorySymbol(undefined)).toBe("square.grid.2x2");
    expect(SUGGESTED_TAGS.length).toBeGreaterThan(0);
  });

  it("cycles the palette, negative indices included", () => {
    expect(paletteColorAt(0)).toBe(DECK_PALETTE[0]);
    expect(paletteColorAt(DECK_PALETTE.length)).toBe(DECK_PALETTE[0]);
    expect(paletteColorAt(-1)).toBe(DECK_PALETTE[DECK_PALETTE.length - 1]);
  });

  it("dev fixtures and fonts are defined", () => {
    expect(typeof DEV_MODE).toBe("boolean");
    expect(DEV_USER.email).toBeTruthy();
    expect(DEV_TOKENS).toBeTruthy();
    expect(fonts.alanSans.bold).toBe("AlanSans-Bold");
  });
});
