export type ScriptTextVariant = "skia" | "native";

/**
 * Which renderer draws the script body.
 *
 * "skia"   — Version 1. Glyphs drawn into a Skia canvas per block, revealed
 *            with the circular distort + colour-shift sweep. Richer, but
 *            every block costs a canvas, so only the first chunk mounts up
 *            front and the rest stream in behind the sweep.
 *
 * "native" — Version 2. Plain React Native <Text> with the same typography
 *            (Newsreader, same size / line height / justification / accent on
 *            bold). The distort sweep is skipped — it samples Skia-drawn
 *            glyphs, so there is nothing for it to distort here — and blocks
 *            fade in instead.
 *
 * Swap versions by moving the comment between the two lines below.
 */
export const SCRIPT_TEXT_VARIANT: ScriptTextVariant = "skia";
// export const SCRIPT_TEXT_VARIANT: ScriptTextVariant = "native";

/** How a block animates in when it mounts. */
export type RevealMode = "distort" | "fade";

export const REVEAL = {
  /**
   * Blocks mounted before the body has been measured — one frame, while the
   * container's width is still unknown and nothing is drawn yet. Once the
   * measurement lands, the real count is however many blocks fill the screen.
   */
  fallbackBlockCount: 2,
  /**
   * Ceiling on that count. A script of one-line blocks could otherwise fit
   * dozens above the fold, and the whole point of chunking is that a 40-block
   * script never mounts 40 canvases in one commit.
   */
  maxInitialBlockCount: 14,
  /** Blocks appended per tick after the sweep finishes. */
  chunkSize: 2,
  /** Gap between chunks. Long enough to leave room for a frame in between. */
  chunkIntervalMs: 90,

  /**
   * Lead-in before the wavefront starts moving.
   *
   * The body can be mounted while its screen is still being pushed. The script
   * screen reads the script straight out of SQLite — the detail screen it was
   * opened from has already cached it — so the text is up within a frame of the
   * push starting, and an out-cubic sweep is two thirds spent by the time the
   * screen stops sliding in. Waiting out the transition is the difference
   * between the reveal being watched and being missed.
   *
   * The preview screen never had the problem: its script lands long after that
   * screen settled, and there the delay just reads as a beat before the text
   * arrives.
   */
  startDelayMs: 380,
  /** Duration of the distort sweep across one block. */
  distortDurationMs: 850,
  /**
   * How long the cascade takes to travel from the top of the screen to the
   * bottom. Each block sweeps itself; what makes them read as one effect down
   * the page is that a block's delay is its vertical position scaled into this
   * window.
   *
   * A single wavefront shared across every block would be nicer, but each block
   * is its own Skia canvas and the shader runs in a canvas-local space — a
   * shared centre has to be expressed as an offset far outside most of those
   * canvases, and that did not survive contact with the device.
   */
  cascadeWindowMs: 420,
  /** Grace period before the shader layer is torn down. */
  distortTeardownMs: 80,
  /** Where a block's wavefront starts, as a fraction of that block — near its
   *  top left, which is where the eye already is. */
  sweepOriginX: 0.12,
  sweepOriginY: 0.15,

  /** Fade used by every block that arrives after the sweep. */
  fadeDurationMs: 260,

  /** Width of the travelling wavefront, in px. */
  ringWidth: 92,
  /** Peak pixel displacement at the wavefront. */
  amplitude: 7,
  /** How hard the wavefront pulls colour toward the accent, 0..1. */
  tintStrength: 0.6,
} as const;

/** Width of a quote's left rule. Shared with the metrics pass, which has to
 *  know how far the rule and its indent push the canvas in. */
export const QUOTE_BORDER_WIDTH = 3;
