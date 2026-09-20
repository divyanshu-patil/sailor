import { Platform } from "react-native";
import { colord } from "colord";

import { fonts } from "@/constants/fonts";

/**
 * The home surface.
 *
 * FOUR HUES, NO OTHERS. Every chromatic value on this screen — card surfaces,
 * icon wells, decorative blobs, cloud puffs, the flame — is one of the four
 * below, used at full strength. Nothing here is a tint, a lightened variant or
 * a colour sampled from the mockup: if something needs to separate from its
 * background, it changes which of the four it is, not how pale it is.
 *
 * The only non-brand values are achromatic: ink, the mascot's placeholder grey,
 * and the page. `inkSoft`/`note` are that same ink at reduced alpha, which is a
 * transparency, not a fifth colour.
 */
export const homeColors = {
  /** Page behind the cards. */
  screen: "#181818",
  hero: "#FBBF79",
  heroText: "#B75C5C",
  cream: "#FFEED9",
  periwinkle: "#D2D2FF",
  rose: "#F6C9D8",

  ink: "#1B1720",
  inkSoft: "rgba(27, 23, 32, 0.62)",
  restorePill: "#E36423",
  /** Handwritten asides on the orange. */
  note: "rgba(27, 23, 32, 0.52)",

  cloudFront: "#FFF8EF",
  cloudBack: "#D2D2FF",

  /** Placeholder mascot. Grey on purpose — it is a hole shaped like the Lottie
   *  that replaces it, and a coloured one would read as finished. */
  mascot: "#C9C4CC",
  mascotInk: "#191418",

  spark: "#E59F4E",
} as const;

/**
 * The circle behind a card's glyph and its arrow.
 *
 * Derived from the card it sits on rather than named: a well is the same colour
 * pressed a step deeper, so it reads as part of the card instead of as a second
 * swatch. Hardcoding three of these is how two of them ended up beige — this
 * cannot drift, and changing a card's tint moves its wells with it.
 */
export const wellFor = (tint: string) => colord(tint).darken(0.08).toHex();

/**
 * How loud the streak is. Tune here — nothing else hardcodes these.
 *
 * The hero numbers are deliberately oversized: the streak is the one thing on
 * this screen that changes daily, and at the design's original scale it read as
 * a label beside the greeting rather than as the screen's second subject.
 */
export const streakDisplay = {
  /** Glyph height in the hero, in points. */
  iconSize: 104,
  /** The hero's count. `lineHeight` follows it, so this is the only knob. */
  countSize: 92,
  /** Tracking on the count. Negative tightens; big numerals need it. */
  countTracking: -4,
  /** "DAY STREAK" / "SAVE IT TODAY" / "START A STREAK". */
  labelSize: 14,
  /** The pill on the Today's Practice card. */
  pillIconSize: 34,
  pillCountSize: 26,
} as const;

export const homeFonts = {
  display: fonts.alanSans.black,
  bold: fonts.alanSans.bold,
  semiBold: fonts.alanSans.semiBold,
  medium: fonts.alanSans.medium,
  regular: fonts.alanSans.regular,
  /** The floating asides — "Ready to speak?", "Same you. Brighter you." */
  note: fonts.kalam.light,
} as const;

/**
 * The hero's cloud parallax. Tune here — nothing else hardcodes these.
 *
 * Amplitudes are fractions of the screen width so the effect is the same size
 * on every phone. The RATIO between the two layers is the depth cue, not either
 * number on its own: move them together and the parallax flattens out. Period
 * is one full left-to-right sweep in ms, so a BIGGER number is SLOWER.
 */
export const cloudDrift = {
  /** Far cloud: small travel, long period. */
  backAmplitude: 0.048,
  backPeriod: 7000,
  /** Near cloud: roughly 3x the travel in half the time. */
  frontAmplitude: 0.085,
  frontPeriod: 6200,
} as const;

/**
 * Each action card's height, in points. Different per card on purpose: they
 * carry different amounts of decoration under their row.
 */
export const cardHeight = {
  /** One row, a corner blob and a mascot peeking in from the right. */
  script: 150,
  /**
   * Two values, because the card holds two different things: the streak pill
   * when there is a streak, and nothing when there is not. Tune them
   * independently — `broken` is the one to raise if the mascot needs more room.
   */
  practice: { alive: 172, broken: 140 },
  /** The tallest: it carries the screen's bottom decoration band. */
  decks: 196,
} as const;

export const homeRadius = {
  /** Only the hero's bottom corners are rounded; it is full-bleed at the top. */
  hero: 36,
  card: 30,
  pill: 999,
} as const;

export const homeShadow = Platform.select({
  ios: {
    shadowColor: "#000000",
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  default: { elevation: 3 },
});
