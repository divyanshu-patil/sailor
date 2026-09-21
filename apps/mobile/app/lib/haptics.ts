import { Presets, Settings } from "react-native-pulsar";

import { usePreferenceStore } from "@/store/preference-store";

/**
 * The app's haptic vocabulary, built on Pulsar's own preset library.
 *
 * Resolved package: react-native-pulsar 1.7.0 (declared ^1.6.1), backed by the
 * PulsarHaptics 1.4.0 pod on iOS. Every preset named here was chosen against
 * the pod's generated pattern data rather than by feel-of-the-name: the tiers
 * below are ordered by measured peak amplitude, duration and event count, so
 * "stronger" means stronger in the signal, not just in the adjective.
 *
 * Deliberately *not* `Presets.System.*`. The system styles are the three iOS
 * impact weights plus notification/selection — five rungs, all of them short
 * single hits, with no way to say "barely there" or "this is the big one with
 * a pattern". Pulsar's own presets give a real dynamic range, which is the
 * point of the card grading below.
 *
 * Every entry is a worklet. Pulsar's presets carry the 'worklet' directive, so
 * a wrapper that did not would be unusable from a gesture handler — and the
 * swipe, dial and flip gestures all fire haptics straight from the UI thread,
 * where a hop through JS would land the feedback a frame or two late.
 */

/**
 * The weight ladder — very mild to very strong.
 *
 * Measured from the PulsarHaptics pod's generated presets (peak amplitude /
 * total duration / discrete event count):
 *
 *   tick    wisp     0.25  ·   60ms · 1 event
 *   tap     feather  0.45  ·  180ms · 1 event
 *   press   nudge    0.60  ·  180ms · 2 events
 *   firm    thump    1.00  ·    0ms · 1 event   (single sharp hit)
 *   heavy   pound    0.95  ·  265ms · 3 events  (pattern)
 *   max     batter   1.00  ·  380ms · 5 events  (pattern)
 *
 * Reach for the lightest rung that still reads. Most taps are `tap`; `heavy`
 * and `max` are for things that genuinely deserve to be felt, and using them
 * everywhere is how an app ends up feeling like a pager.
 */
export const weight = {
  /** Barely there. Ruler units, scroll ticks, crossing a drag threshold. */
  tick: () => {
    "worklet";
    Presets.wisp();
  },
  /** The default press. Soft, short, unobtrusive. */
  tap: () => {
    "worklet";
    Presets.feather();
  },
  /** A press that chose something. */
  press: () => {
    "worklet";
    Presets.nudge();
  },
  /** A single sharp hit — committing, landing, snapping into place. */
  firm: () => {
    "worklet";
    Presets.thump();
  },
  /** Three-beat pattern. Something substantial happened. */
  heavy: () => {
    "worklet";
    Presets.pound();
  },
  /** Five-beat pattern, full amplitude. The loudest thing the app says. */
  max: () => {
    "worklet";
    Presets.batter();
  },
} as const;

/**
 * Meaning-named feedback.
 *
 * Named for the event rather than the sensation, so the mapping can be retuned
 * in one place without hunting through call sites for "the medium one".
 */
export const haptics = {
  // ---- navigation & flow -------------------------------------------------
  /** Entering a flow — a deliberate, committed press. */
  start: () => {
    "worklet";
    Presets.ignition();
  },
  /** Moving to the next line. Happens several times a minute, so it stays
   *  light; anything heavier becomes fatiguing fast. */
  advance: () => {
    "worklet";
    Presets.feather();
  },
  /** Stepping backwards — same weight as advancing, it is the same kind of
   *  move, just in reverse. */
  back: () => {
    "worklet";
    Presets.feather();
  },
  /** The last line is done, but nothing has been committed yet. */
  finishLine: () => {
    "worklet";
    Presets.bloom();
  },
  /**
   * A multi-step form moved forward one step.
   *
   * Paired with `stepBack` below, and deliberately its opposite: this one is
   * firmer and lands quickly, that one is softer and decays. In a wizard the
   * two buttons sit side by side and are pressed without much looking, so the
   * direction you just went should be the thing you feel — not a shared click
   * that leaves "did I go forward or back?" to the eye.
   */
  stepForward: () => {
    "worklet";
    Presets.nudge();
  },
  /** A multi-step form went back a step. A soft decay — undoing costs less
   *  than doing, and reversing should feel like releasing, not committing. */
  stepBack: () => {
    "worklet";
    Presets.wane();
  },
  /** Ran into the end of something — first card, last card, a closed door.
   *  A dull stop, not a punishment. */
  boundary: () => {
    "worklet";
    Presets.thud();
  },
  /** A drag passed the point where releasing will commit. The lightest thing
   *  in the vocabulary: it fires mid-gesture, while the finger is still down. */
  threshold: () => {
    "worklet";
    Presets.wisp();
  },

  // ---- selection ---------------------------------------------------------
  /** Moving between discrete options — a dial unit, a segment, a list row. */
  select: () => {
    "worklet";
    Presets.pip();
  },
  /** Crossing into a new *group* of options, not just the next one along. */
  selectGroup: () => {
    "worklet";
    Presets.blip();
  },
  /** A switch went on. */
  toggleOn: () => {
    "worklet";
    Presets.latch();
  },
  /** A switch went off. Deliberately softer than on: undoing is cheaper than
   *  doing, and it should feel that way. */
  toggleOff: () => {
    "worklet";
    Presets.wane();
  },

  // ---- outcomes ----------------------------------------------------------
  /** Something small worked. A save, a copy, a field accepted. */
  success: () => {
    "worklet";
    Presets.bloom();
  },
  /** Something big worked. A purchase, a generated script, a finished deck. */
  successBig: () => {
    "worklet";
    Presets.fanfare();
  },
  /** Streak incremented. Once a day, so it can afford to be a moment. */
  celebrate: () => {
    "worklet";
    Presets.triumph();
  },
  /** Something is off but recoverable — a queued sync, a soft validation miss. */
  warn: () => {
    "worklet";
    Presets.buzz();
  },
  /** Something failed. Eight closely spaced events: it reads as *wrong*
   *  rather than merely strong, which is what separates it from `heavy`. */
  error: () => {
    "worklet";
    Presets.glitch();
  },
  /** Something was destroyed. A clean cut, not an explosion. */
  destroy: () => {
    "worklet";
    Presets.cleave();
  },

  // ---- recording ---------------------------------------------------------
  /** Recording began. */
  recordStart: () => {
    "worklet";
    Presets.ignition();
  },
  /** Recording paused or resumed. */
  recordPause: () => {
    "worklet";
    Presets.plink();
  },
  /** Recording stopped and a take exists. */
  recordStop: () => {
    "worklet";
    Presets.latch();
  },

  // ---- cards -------------------------------------------------------------
  /** A card turned over to show its reveal. An opening, not a hit. */
  reveal: () => {
    "worklet";
    Presets.bloom();
  },
  /** The card fell back to its front face. */
  conceal: () => {
    "worklet";
    Presets.wane();
  },
  /** Text editing began on a card. */
  editStart: () => {
    "worklet";
    Presets.blip();
  },
  /** An edit was committed. "Latched" — secured, done. */
  editCommit: () => {
    "worklet";
    Presets.latch();
  },
} as const;

/**
 * The card impact ladder — index 0 (very mild) to 4 (very strong).
 *
 * Indexed by the tier from `getImpactTier`, which is the *same* tier that
 * picks the card's colour. That shared index is the whole design: a card
 * cannot look like a climax and feel like an aside, because one number drives
 * both. See `script-practice/utils/colorAssignment.ts`.
 *
 * The top two rungs are genuine multi-event patterns rather than single hits —
 * a standout line should feel structurally different, not just louder.
 */
const CARD_TIER_HAPTICS = [
  weight.tick, // 0 · wisp    — an aside
  weight.tap, // 1 · feather — ordinary
  weight.press, // 2 · nudge   — worth noticing
  weight.heavy, // 3 · pound   — a real beat (pattern)
  weight.max, // 4 · batter  — the moment (pattern)
] as const;

/** Play the haptic for a card of this impact tier. */
export const playCardHaptic = (tier: number) => {
  "worklet";
  const clamped = tier < 0 ? 0 : tier > 4 ? 4 : tier;
  CARD_TIER_HAPTICS[clamped]!();
};

/**
 * Picking a teleprompter speed — the cue *is* the speed.
 *
 * Rather than one click for all seven multipliers, each speed gets a preset
 * whose own shape matches the pace it selects: the slow end is soft and drawn
 * out, the fast end is sharp and rapid-fire. Measured from the pod's pattern
 * data, peak amplitude climbs and the events pack tighter as the speed rises:
 *
 *   0.25x  wane     0.42 · 450ms · continuous fade   — a slow exhale
 *   0.5x   feather  0.45 · 180ms · 1 event
 *   1x     nudge    0.60 · 180ms · 2 events          — the reference
 *   1.25x  snap     0.70 ·  90ms · 2 events
 *   1.5x   strike   0.75 ·  80ms · 1 event           — tight and sharp
 *   2x     spark    1.00 · 185ms · 3 events
 *   3x     barrage  1.00 · 309ms · 7 events          — rapid fire
 *
 * That matters because the speed menu is used mid-delivery, with the eyes on
 * the script rather than the toolbar. A distinct feel per step says which one
 * landed without looking, and the direction is legible even if the exact rung
 * is not: it got softer and longer, or sharper and busier.
 *
 * Thresholds rather than a lookup keyed on the seven current values, so adding
 * a 0.75x to `TELEPROMPTER.speeds` does not silently fall through to a default.
 */
export const playSpeedHaptic = (speed: number) => {
  "worklet";
  if (speed < 0.4) return Presets.wane();
  if (speed < 0.75) return Presets.feather();
  if (speed < 1.1) return Presets.nudge();
  if (speed < 1.35) return Presets.snap();
  if (speed < 1.75) return Presets.strike();
  if (speed < 2.5) return Presets.spark();
  return Presets.barrage();
};

/**
 * The presets worth paying for up front.
 *
 * `preloadPresets` parses each pattern once and turns Pulsar's preset cache on
 * (it sets the flag itself). Without it every play rebuilds and re-parses the
 * pattern, which is a cost the card stack would pay on every single swipe.
 * Only the hot set — the ones on a gesture path — is listed; the rest parse on
 * first use, which is fine for something that fires once a session.
 */
const PRELOAD = [
  "wisp",
  "feather",
  "nudge",
  "thump",
  "pound",
  "batter",
  "pip",
  "blip",
  "bloom",
  "wane",
  "thud",
  "latch",
  "plink",
  // The speed menu's rungs — picked mid-delivery, so they must not stall.
  "snap",
  "strike",
  "spark",
  "barrage",
];

/**
 * Haptics, gated on the user's preference.
 *
 * `emotionHapticsEnabled` has been in Settings since before this feature, with
 * a toggle the user could flip and nothing anywhere reading it — every Pulsar
 * call in the app fired regardless. Rather than add a check at each call site,
 * this drives Pulsar's own global switch from the store, which fixes every
 * existing call site as a side effect and cannot be forgotten by the next one
 * somebody adds.
 */
export function startHapticsSync(): () => void {
  const read = () =>
    usePreferenceStore.getState().preferences.emotionHapticsEnabled;

  // Audio alongside every haptic, always. Pulsar gates its audio behind the
  // same `play()` as the vibration (see Player.play in the PulsarHaptics pod),
  // so switching haptics off silences the sound too — which is the behaviour
  // you want: one switch, no case where a muted app still chirps.
  Settings.enableSound(true);
  Settings.preloadPresets(PRELOAD);

  let previous = read();
  Settings.enableHaptics(previous);

  return usePreferenceStore.subscribe(() => {
    const next = read();
    if (next === previous) return;
    previous = next;
    Settings.enableHaptics(next);
  });
}
