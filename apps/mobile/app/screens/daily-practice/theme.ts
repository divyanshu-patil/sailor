import { Platform } from "react-native";
import type { WithSpringConfig } from "react-native-reanimated";

import { fonts } from "@/constants/fonts";

/**
 * The daily-practice surface.
 *
 * A warm off-white shell with tinted cards, rather than the app's default white:
 * this flow is meant to feel like a calm corner of the app you visit once a day,
 * and the tint is what separates it from the working screens without inventing a
 * second brand. Card colours are the existing deck palette at low opacity, so
 * nothing here is a new hue.
 */
export const dailyTheme = (isDark: boolean) => ({
  bg: isDark ? "#151316" : "#FAF4F0",
  /** The "Today's topic" card — the one strongly tinted surface. */
  card: isDark ? "#2A1F24" : "#F9E0E4",
  /** Plain rows and panels that sit on `bg`. */
  cardAlt: isDark ? "#1F1C20" : "#FFFFFF",
  ink: isDark ? "#F6F2EF" : "#1B1B23",
  inkColored: isDark ? "#d95b75" : "#d95b75",
  inkSoft: isDark ? "#A8A099" : "#6F6A73",
  inkFaint: isDark ? "#6A645F" : "#ADA6AA",
  accent: "#EC6B87",
  accentSoft: isDark ? "#3B222A" : "#FBDDE3",
  onAccent: "#FFFFFF",
  button: isDark ? "#F6F2EF" : "#22222C",
  buttonInk: isDark ? "#1B1B23" : "#FFFFFF",
  buttonSoft: isDark ? "#262229" : "#F0E7E3",
  divider: isDark ? "#302A2E" : "#EFE3DE",
  iconTint: isDark ? "#F6F2EF" : "#22222C",
});

export type DailyTheme = ReturnType<typeof dailyTheme>;

export const dailyFonts = {
  display: fonts.alanSans.bold,
  semibold: fonts.alanSans.semiBold,
  medium: fonts.alanSans.medium,
  body: fonts.alanSans.regular,
  serif: fonts.newsreader.regular,
  serifMedium: fonts.newsreader.medium,
  /** The completion quote. Italic serif reads as a pull-quote rather than as
   *  another UI string. */
  serifItalic: fonts.newsreader.italic,
  serifMediumItalic: fonts.newsreader.mediumItalic,
  handwritten: fonts.kalam.regular,
};

/** Reading pace used for the "~N min" estimate. 130 wpm is a deliberate,
 *  spoken-aloud pace — silent reading rates would understate it by half. */
export const SPEAKING_WPM = 130;

export const estimateMinutes = (text: string): number => {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / SPEAKING_WPM));
};

/** Splits a snippet into the lines the practice screen steps through. */
export const toLines = (body: string): string[] =>
  body
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);

/**
 * The single spring used across daily practice.
 *
 * Damping only — no stiffness or mass. Reanimated derives the rest from its
 * defaults, and a heavily damped spring with default stiffness settles without
 * the overshoot that makes a calm screen feel bouncy. Typed so a stray
 * `duration` or `mass` is a compile error rather than a silently different feel.
 */
export const DAILY_SPRING: WithSpringConfig = { damping: 70 };

/**
 * The teleprompter's settle, which `DAILY_SPRING` is the wrong shape for.
 *
 * Damping 70 against Reanimated's default stiffness of 100 is a damping ratio
 * of 3.5 — heavily overdamped. Over the few points a button press travels that
 * reads as calm; over the ~110pt a paragraph moves it takes about two and a
 * half seconds to visually arrive, so the reel appears to stall after the
 * finger lifts.
 *
 * Stiffness 190 with damping 26 is a ratio of 0.94: just inside critical, so it
 * lands in roughly a third of a second with no overshoot to bounce the text.
 */
export const TELEPROMPTER_SPRING: WithSpringConfig = {
  stiffness: 190,
  damping: 26,
  mass: 1,
};

/** Corner radii, kept in one place so the card, rows and buttons stay a family. */
export const radius = {
  card: 30,
  row: 20,
  pill: 999,
  /** Buttons are fully rounded. */
  button: 999,
} as const;

/**
 * Space a transparent native header occupies, on top of the safe-area inset.
 *
 * `useHeaderHeight` isn't reachable here — @react-navigation/elements isn't a
 * resolvable dependency of this app — and a transparent header means content
 * starts at y=0 and renders underneath the chevron. 44pt is the standard iOS
 * navigation bar height; screens add it to `insets.top`.
 */
export const HEADER_INSET = 44;

export const shadow = Platform.select({
  ios: {
    shadowColor: "#8A6A55",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  default: { elevation: 3 },
});
