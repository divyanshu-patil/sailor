/**
 * Every number the teleprompter runs on.
 *
 * The one to tune is `basePixelsPerSecond`: it is the speed at 1x, and every
 * multiplier in the menu is a factor of it. 30pt/s is about 150 words a minute
 * at the type size below — a normal presenting pace — so 0.5x is a slow read
 * and 2x is a skim.
 */
export const TELEPROMPTER = {
  /** Scroll speed at 1x, in points per second. */
  basePixelsPerSecond: 40,

  /** Multipliers offered in the toolbar menu, in the order they appear. */
  speeds: [0.25, 0.5, 1, 1.25, 1.5, 2, 3] as const,
  /** Which of those the screen opens on. */
  defaultSpeed: 1,

  /** Gap between two sentences of the same paragraph. */
  lineGap: 24,
  /** Gap where the script had a blank line — a new paragraph or beat. */
  paragraphGap: 46,
  /** Space above a note ([HOOK], a stage direction) and below it. */
  noteGap: 40,

  fontSize: 32,
  lineHeightMultiplier: 1.3,
  /** Notes are reference, not script: small enough to skip with the eye. */
  noteFontSize: 14,
  /** Pause blocks (`> ...`) sit between the two. */
  asideFontSize: 20,

  /**
   * Where the line being read sits, as a fraction of the viewport height.
   * Above centre, because the eye reads down and the lines coming next are
   * worth more room than the ones already said.
   */
  focusRatio: 0.34,
  /** Distance from the focus line at which text reaches its dimmest, in pt. */
  falloff: 210,
  /** Opacity of a line one `falloff` away, and of everything past it. */
  dimOpacity: 0.16,
  /**
   * Steps the dimming is rounded to.
   *
   * The whole script is mounted, so a continuous opacity meant every line on
   * screen wrote a new value to its native view on every frame — which is what
   * made the scroll stutter. Rounded to steps, a line's opacity is unchanged
   * on most frames, Reanimated skips the update, and the ramp is still smooth
   * to the eye. Raise it if you can see the stepping; lower it if the scroll
   * is still heavy.
   */
  opacitySteps: 24,

  /** Side padding of the prompt text. */
  sidePadding: 20,
  /**
   * How far the page colour veils the text behind the start button, 0..1.
   * Deliberately short of 1 — the script keeps running behind the button and
   * seeing it move is what says the prompt is still going.
   */
  bottomVeil: 0.9,

  /** How long a finger has to rest before the hold takes effect. Short: this
   *  is a "wait" or a "get on with it", not a deliberate command. */
  longPressMs: 180,
  /**
   * Holding the screen does one of two things depending on where.
   *
   * The middle pauses; either edge runs the prompt faster for as long as the
   * finger is down. It is the gesture people already have from Instagram —
   * hold to stop, hold at the side to skip ahead — and it means the two
   * things you want mid-read are both one thumb away, with nothing new on
   * screen to explain.
   */
  boostMultiplier: 2,
  /** Width of each edge zone, as a fraction of the screen. */
  edgeZone: 0.3,
} as const;

export type Speed = (typeof TELEPROMPTER.speeds)[number];

/** "1x", "0.25x" — the menu labels and the toolbar's current-speed button. */
export const speedLabel = (speed: number) => `${speed}x`;
