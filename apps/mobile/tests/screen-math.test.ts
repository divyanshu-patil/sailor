import { describe, expect, it, vi } from "vitest";

// Reanimated's interpolation and easing are plain functions in plain files —
// the real ones, minus the native module the package entry drags in.
vi.mock("react-native-reanimated", async () => ({
  ...(await import("react-native-reanimated/lib/module/interpolation.js")),
  Easing: (await import("react-native-reanimated/lib/module/Easing.js")).Easing,
  createAnimatedComponent: (component: unknown) => ({ animated: component }),
}));
vi.mock("@expo/ui/swift-ui", () => ({ Host: "Host" }));
vi.mock("@expo/ui/swift-ui/modifiers", () => {
  const modifier = (name: string) => (...args: unknown[]) => ({ [name]: args });
  return {
    Animation: { spring: (config: unknown) => ({ spring: config }) },
    animation: modifier("animation"),
    contentTransition: modifier("contentTransition"),
    font: modifier("font"),
    foregroundStyle: modifier("foregroundStyle"),
    frame: modifier("frame"),
  };
});

import { useColorScheme } from "react-native";

import { AnimatedHost, AnimatedPressable } from "@/components/ui/animated/AnimatedComponents";
import * as apiBarrel from "@/lib/api";
import { api, apiClient } from "@/lib/api/client";
import { BottomTabInset, Colors, Fonts, Spacing, useColors } from "@/constants/theme";
import { useColorScheme as useScheme } from "@/hooks/use-color-scheme";
import { defaultHeaderConfig } from "@/constants/header";
import { EMAIL_REGEX, MIN_PASSWORD_LENGTH } from "@/screens/auth/validation";
import {
  DAILY_SPRING,
  dailyFonts,
  dailyTheme,
  estimateMinutes,
  HEADER_INSET,
  shadow,
  TELEPROMPTER_SPRING,
  toLines,
} from "@/screens/daily-practice/theme";
import { cardHeight, homeColors, homeShadow, wellFor } from "@/screens/home/theme";
import { COLUMN_GAP, SCREEN_PADDING } from "@/screens/presentation/decks/components/constants";
import { layoutText } from "@/screens/presentation/generation/preview/components/script-text/text-layout";
import { AUDIENCE_DIAL, MOOD_DIAL, PROFESSION_DIAL } from "@/screens/presentation/new-script/components/dial-data";
import {
  arcCenterY,
  arcTop,
  bandGap,
  CIRCLE_R,
  CX,
  focusCenterY,
  ITEM_R,
  pickBand,
  RING_R,
  ringMaxD,
  ringStep,
  STEP_C,
  wrapD,
  wrapIndex,
} from "@/screens/presentation/new-script/components/dial-geometry";
import { AUDIENCES, DEFAULT_STATE } from "@/screens/presentation/new-script/types/types";
import {
  deliveryModifier,
  digitModifiers,
  RETURN_START_X,
  separatorModifiers,
  staticModifiers,
  VISIBLE_COUNT,
} from "@/screens/presentation/script-practice/constants";
import {
  getArcY,
  getCascadedStackRotation,
  getCascadeProgress,
  getDragProgress,
  getNormalCardTransform,
  getVirtualDepth,
  getPrevCardReturnProgress,
  getRotation,
} from "@/screens/presentation/script-practice/utils/cardMath";
import { EXPERIENCE_LEVELS, rowLabelModifiers } from "@/screens/profile/edit-profile/components/constants";
import { restoreColors, restoreMotion } from "@/screens/streak-restore/theme";
import { AUDIENCE_OPTIONS } from "@/types/presentation";
import { MOOD_OPTIONS } from "@/types/settings/preferences";
import { PROFESSIONS } from "@/types/user";

describe("new-script dials", () => {
  it("carries a short label, a blurb and a glyph for every option", () => {
    expect(PROFESSION_DIAL).toHaveLength(PROFESSIONS.length);
    expect(MOOD_DIAL).toHaveLength(MOOD_OPTIONS.length);
    expect(AUDIENCE_DIAL).toHaveLength(AUDIENCE_OPTIONS.length);
    for (const option of [...PROFESSION_DIAL, ...AUDIENCE_DIAL]) {
      expect(option).toMatchObject({ label: expect.any(String), short: expect.any(String), icon: expect.any(String) });
    }
    expect(MOOD_DIAL.every((m) => m.emoji && m.blurb)).toBe(true);
  });

  it("lays the arcs out on a 390 × 844 screen", () => {
    expect(CX).toBe(195);
    expect(ITEM_R).toBe(316);
    expect(STEP_C).toBeCloseTo(106 / 316);
    expect(RING_R).toBe(156);
    expect(CIRCLE_R).toBeCloseTo(Math.hypot(390, 844) * 1.4);
    expect(bandGap(844)).toBe(152);
    expect(bandGap(500)).toBe(117.5);
    expect(arcTop(844, 1) - arcTop(844, 0)).toBe(152);
    // The audience band drops a little further.
    expect(arcTop(844, 2) - arcTop(844, 1)).toBeCloseTo(176);
    expect(arcCenterY(844, 0)).toBeCloseTo(arcTop(844, 0) + 390);
    expect(focusCenterY(1000)).toBe(560);
  });

  it("hit-tests the curved bands, not their boxes", () => {
    const top = arcTop(844, 0);
    expect(pickBand(844, CX, top - 1)).toBe(-1);
    expect(pickBand(844, CX, top + 1)).toBe(0);
    expect(pickBand(844, CX, 840)).toBe(2);
    // At the screen edge the arc has sagged, so the same height is still above it.
    expect(pickBand(844, 0, top + 1)).toBe(-1);
    // Far outside the circle the sag tops out at the radius.
    expect(pickBand(844, 5000, top + 391)).toBe(0);
  });

  it("wraps both ways round the ring", () => {
    expect(ringStep(5)).toBeCloseTo((2 * Math.PI) / 5);
    expect(ringStep(11)).toBeCloseTo((2 * Math.PI) / 9);
    expect(wrapD(4, 11)).toBe(4);
    expect(wrapD(8, 11)).toBe(-3);
    expect(wrapD(-1, 5)).toBe(-1);
    expect(wrapIndex(-0.6, 5)).toBe(4);
    expect(wrapIndex(7.2, 5)).toBe(2);
    expect(ringMaxD(5)).toBe(5);
    expect(ringMaxD(11)).toBe(4.5);
  });
});

describe("script-practice card stack", () => {
  it("cycles rotation and clamps drag", () => {
    // `0 * -8` is -0; the transform doesn't care, so neither does the test.
    expect([0, 1, 2, 3, 4].map((i) => getRotation(i) + 0)).toEqual([0, -8, -16, 0, -8]);
    expect(getDragProgress(-500)).toBe(-1);
    expect(getDragProgress(125)).toBe(0.5);
    expect(getArcY(-0.5)).toBe(25);
    expect(getPrevCardReturnProgress(0, 585)).toBe(1);
    expect(getPrevCardReturnProgress(900, 585)).toBeCloseTo(0);
    expect(getCascadeProgress(0.5, 0.3)).toBe(-0.5);
    expect(getCascadeProgress(-0.2, 0.3)).toBe(0.3);
    expect(getCascadedStackRotation(1.5)).toBe(-12);
    expect(getCascadedStackRotation(9)).toBeCloseTo(0);
  });

  it("moves the front card with the finger and settles the rest", () => {
    expect(
      getNormalCardTransform({ currIndex: 0, dragTranslateX: 125, prevCardTranslateX: undefined, returnStartX: 585 }),
    ).toEqual({ translateX: 125, translateY: 25, rotate: 9 });
    expect(
      getNormalCardTransform({ currIndex: 1, dragTranslateX: 0, prevCardTranslateX: undefined, returnStartX: 585 }),
    ).toMatchObject({ translateX: 0, translateY: 0, rotate: -8 });
    // Swiping back: the card behind rotates halfway to the next slot.
    expect(
      getNormalCardTransform({ currIndex: 1, dragTranslateX: -125, prevCardTranslateX: 292.5, returnStartX: 585 }).rotate,
    ).toBe(-12);
  });

  it("builds the counters' SwiftUI modifiers", () => {
    expect(RETURN_START_X).toBe(585);
    expect(VISIBLE_COUNT).toBe(4);
    expect(digitModifiers(1)).toHaveLength(4);
    expect(deliveryModifier(2)[1]).toEqual({ animation: [{ spring: { bounce: 0.25 } }, 2] });
    expect(separatorModifiers).toHaveLength(2);
    expect(staticModifiers).toHaveLength(2);
  });
});

describe("script text layout", () => {
  // Every glyph is 10pt wide except the space, which a font can report as ~0.
  const font = (space = 5) => ({
    measureText: (text: string) => ({ width: text === " " ? space : text.length * 10 }),
    getMetrics: () => ({ ascent: -8, descent: 2 }),
  });
  const fonts = (space?: number) => {
    const f = font(space);
    return { regular: f, bold: font(space), italic: font(space), boldItalic: font(space) } as never;
  };
  const seg = (text: string, bold = false, italic = false) => ({ text, bold, italic });

  it("wraps words, picks styled fonts and justifies all but the last line", () => {
    const set = fonts();
    const { words, height } = layoutText(
      [[seg("aa bb "), seg("cc", true), seg("dd", false, true), seg("ee", true, true)]],
      set,
      60,
      20,
      true,
      16,
    );
    // Lines of "aa bb" / "cc dd" / "ee" at 20pt apart, starting on the ascent.
    expect(words.map((w) => [w.text, w.y])).toEqual([
      ["aa", 8],
      ["bb", 8],
      ["cc", 28],
      ["dd", 28],
      ["ee", 48],
    ]);
    // Justified: the gap stretches so "bb" ends flush with the 60pt edge.
    expect(words[1].x).toBe(40);
    expect(words[2].bold).toBe(true);
    expect(height).toBe(48 + 2);
  });

  it("keeps blank lines, ragged lines and tiny spaces sensible", () => {
    const { words, height } = layoutText([[seg("  ")], [seg("aa bb")]], fonts(0), 1000, 20, false, 16);
    // A space measured as zero falls back to a quarter of the font size.
    expect(words[1].x).toBe(20 + 4);
    expect(words[0].y).toBe(28);
    expect(height).toBe(30);
    expect(layoutText([], fonts(), 100, 20, true, 16)).toEqual({ words: [], height: 20 });
  });
});

describe("surfaces and constants", () => {
  it("daily practice paces and splits its text", () => {
    expect(dailyTheme(true).bg).not.toBe(dailyTheme(false).bg);
    expect(estimateMinutes("")).toBe(1);
    expect(estimateMinutes("word ".repeat(260))).toBe(2);
    expect(toLines("  One. Two!  Three? ")).toEqual(["One.", "Two!", "Three?"]);
    expect(DAILY_SPRING).toEqual({ damping: 70 });
    expect(TELEPROMPTER_SPRING.stiffness).toBe(190);
    expect(HEADER_INSET).toBe(44);
    expect(shadow).toMatchObject({ shadowColor: "#8A6A55" });
    expect(dailyFonts.display).toBeTruthy();
  });

  it("home derives its wells from the card colour", () => {
    expect(wellFor(homeColors.cream)).toMatch(/^#[0-9a-f]{6}$/);
    expect(wellFor(homeColors.cream)).not.toBe(homeColors.cream.toLowerCase());
    expect(cardHeight.practice.alive).toBeGreaterThan(cardHeight.practice.broken);
    expect(homeShadow).toMatchObject({ shadowOpacity: 0.16 });
  });

  it("streak restore times its reveal from one table", () => {
    expect(restoreMotion.reveal).toBe(1050);
    expect(restoreMotion.easing.reveal(1)).toBeCloseTo(1);
    expect(restoreColors.won.bg).not.toBe(restoreColors.ask.bg);
  });

  it("the base palette follows the colour scheme", () => {
    expect(useColors().colors).toBe(Colors.light);
    vi.mocked(useColorScheme).mockReturnValueOnce("dark");
    expect(useColors().colors).toBe(Colors.dark);
    expect(Object.keys(Colors.dark)).toEqual(Object.keys(Colors.light));
    expect(Fonts.rounded).toBe("ui-rounded");
    expect(BottomTabInset).toBe(50);
    expect(Spacing.three).toBe(16);
    expect(useScheme).toBe(useColorScheme);
  });

  it("the tab inset is zero where there is no tab bar to clear", async () => {
    vi.resetModules();
    const { Platform } = await import("react-native");
    Platform.OS = "web";
    const web = await import("@/constants/theme");
    expect(web.BottomTabInset).toBe(0);
    expect(web.Fonts.sans).toBe("var(--font-display)");
  });

  it("forms and layout constants", () => {
    expect(EMAIL_REGEX.test("a@b.co")).toBe(true);
    expect(EMAIL_REGEX.test("a@b")).toBe(false);
    expect(MIN_PASSWORD_LENGTH).toBe(8);
    expect(AUDIENCES).toEqual(AUDIENCE_OPTIONS.map((o) => o.label));
    expect(DEFAULT_STATE).toMatchObject({ durationMinutes: 10, cardCount: 35 });
    expect(EXPERIENCE_LEVELS.map((l) => l.tag)).toEqual(["beginner", "intermediate", "advanced", "pro"]);
    expect(rowLabelModifiers(true)[1]).toEqual({ frame: [{ maxWidth: Infinity, alignment: "leading" }] });
    expect(rowLabelModifiers()[1]).toEqual({ frame: [{ maxWidth: 92, alignment: "leading" }] });
    expect(COLUMN_GAP + SCREEN_PADDING).toBe(22);
    expect(defaultHeaderConfig.headerLargeTitleEnabled).toBe(true);
    expect(AnimatedPressable).toBeTruthy();
    expect(AnimatedHost).toEqual({ animated: "Host" });
    expect(apiBarrel).toMatchObject({ api, apiClient });
  });
});

describe("getVirtualDepth", () => {
  it("slides the card behind toward the front as the front one leaves", () => {
    const at = (dragTranslateX: number, prevCardTranslateX?: number) =>
      getVirtualDepth({ currIndex: 1, dragTranslateX, prevCardTranslateX, returnStartX: 585 });
    expect(at(0)).toBe(1);
    expect(at(125)).toBe(0.5);
    expect(at(-125, 292.5)).toBe(1.5);
  });
});
