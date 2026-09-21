import { Easing } from "react-native-reanimated";

import { fonts } from "@/constants/fonts";

/**
 * The restore flow's surface.
 *
 * Two palettes, because the screen changes colour underneath itself: `ask` is
 * the cream it opens on, `won` the yellow the reveal floods it with. They are
 * kept apart rather than merged into one object with a `restored` suffix on
 * every key — the whole screen swaps from one to the other at a single moment,
 * and picking a palette is one decision, not fifteen.
 */
export const restoreColors = {
  ask: {
    bg: "#FBF6EC",
    ink: "#141414",
    body: "#8A8894",
    note: "#9A97A6",
    button: "#1F1D1D",
    buttonInk: "#FFFFFF",
    /** The short strokes flanking the button. */
    spark: "#F0803C",
  },
  won: {
    bg: "#FCE79A",
    ink: "#2B2112",
    body: "#7A6438",
    note: "#8A7340",
    button: "#211C14",
    buttonInk: "#FFFFFF",
    spark: "#F5A623",
  },
  blocked: {
    /** Same cream as `ask` — the cap is a dead end, not a different place. */
    bg: "#FBF6EC",
    ink: "#141414",
    body: "#6F7B8C",
    note: "#9A97A6",
    /** Greyed: the button is present but refuses, which says more than hiding
     *  it would. */
    button: "#A9A9A9",
    buttonInk: "#FFFFFF",
    spark: "#F2C94C",
  },
} as const;

export const restoreFonts = {
  display: fonts.alanSans.black,
  bold: fonts.alanSans.bold,
  semiBold: fonts.alanSans.semiBold,
  regular: fonts.alanSans.regular,
  note: fonts.kalam.light,
} as const;

/**
 * Every duration and curve the restore animation runs on. Nothing below this
 * file hardcodes a number — change one here and only that beat moves.
 *
 * The order of the release sequence is the whole effect, so it is written out
 * rather than left to be inferred from five scattered `withDelay`s:
 *
 *   0ms                 finger lifts. The puck — a white disc under the
 *                       button's flame — begins to swell.
 *   `revealDelay`       the yellow starts growing out from behind the button.
 *   ~`contentOut`       the question, the blurb and the button have faded; by
 *                       now the yellow is well past them, so they are leaving
 *                       under cover rather than blinking out on an empty page.
 *   `reveal`            the yellow has reached every corner.
 *   then                the restored scene fades up on it.
 *
 * The reveal is deliberately the longest beat. It is the only one carrying the
 * screen from one state to the other, and anything under about 700ms reads as a
 * cut to a different screen instead of this screen changing.
 */
/**
 * Multiplies every duration below. 1 is shipping speed.
 *
 * Raise it to watch the sequence in slow motion while tuning — the whole point
 * of the durations living in one object is that the order and the overlaps can
 * be checked without re-timing five call sites by hand.
 */
export const RESTORE_SPEED = 1;

const t = (ms: number) => Math.round(ms * RESTORE_SPEED);

export const restoreMotion = {
  /** Finger down: the sparks pull in toward the button. */
  pressIn: t(150),
  /** Finger lifted without committing (or the request failed). */
  pressOut: t(280),
  /** How short the sparks get at full press, as a fraction of their length. */
  sparkPressScale: 0.35,

  /** Held before the yellow starts, so the press reads as landing first. */
  revealDelay: t(90),
  reveal: t(1050),
  /** The intro's words and button leaving under the growing yellow. */
  contentOut: t(300),

  /** The restored scene arriving. Started from the reveal's own completion
   *  callback, not on a delay of its own — the two must not overlap, so that
   *  the new screen appears on a canvas that is already its colour. */
  wonIn: t(560),

  /** Reversing the reveal after a failed request. Quicker than it grew: an
   *  animation that is being taken back should not be savoured. */
  revealOut: t(420),

  easing: {
    /** The yellow. Decelerating hard — it arrives, it does not coast in. */
    reveal: Easing.out(Easing.cubic),
    /** Everything leaving under it. */
    out: Easing.out(Easing.quad),
    /** The sparks answering the finger. */
    press: Easing.out(Easing.quad),
    /** The restored scene. */
    won: Easing.out(Easing.cubic),
  },
} as const;
