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
   * Blocks mounted in the very first commit. These are the ones that get the
   * distort sweep, and they're sized to roughly fill the first screen — the
   * whole point is that a 40-block script never mounts 40 canvases at once.
   */
  initialBlockCount: 2,
  /** Blocks appended per tick after the sweep finishes. */
  chunkSize: 2,
  /** Gap between chunks. Long enough to leave room for a frame in between. */
  chunkIntervalMs: 90,

  /** Duration of the circular distort sweep across one block. */
  distortDurationMs: 850,
  /** Offset between the first blocks' sweeps, so they cascade. */
  distortStaggerMs: 110,
  /** Grace period before the shader layer is torn down. */
  distortTeardownMs: 80,

  /** Fade used by every block that arrives after the sweep. */
  fadeDurationMs: 260,

  /** Width of the travelling wavefront, in px. */
  ringWidth: 92,
  /** Peak pixel displacement at the wavefront. */
  amplitude: 7,
  /** How hard the wavefront pulls colour toward the accent, 0..1. */
  tintStrength: 0.6,
} as const;
