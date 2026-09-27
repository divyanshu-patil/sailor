/**
 * The part of the dotLottie state-machine format the Blooby mascots use,
 * interpreted in JS so a `.lottie` can play through Skia's Skottie (which only
 * knows plain Lottie) and still switch states from its own inputs.
 *
 * Covered: `PlaybackState`s that play a marker `segment`, `loop`, and
 * `Transition`/`Tweened` transitions guarded by Boolean, String and Numeric
 * inputs. Not covered (no mascot uses them): events, actions, global states.
 */

export type InputValue = boolean | string | number;
export type Inputs = Record<string, InputValue>;

interface Guard {
  type: "Boolean" | "String" | "Numeric";
  inputName: string;
  conditionType:
    | "Equal"
    | "NotEqual"
    | "GreaterThan"
    | "GreaterThanOrEqual"
    | "LessThan"
    | "LessThanOrEqual";
  compareTo: InputValue;
}

interface Transition {
  type: "Transition" | "Tweened";
  toState: string;
  guards?: Guard[];
  /** Seconds, on `Tweened`. */
  duration?: number;
}

export interface MachineState {
  name: string;
  /** Marker name. Absent means the whole timeline. */
  segment?: string;
  loop?: boolean;
  transitions?: Transition[];
}

export interface Machine {
  initial: string;
  states: MachineState[];
  inputs?: { name: string; value: InputValue }[];
}

/** The machine's declared input defaults, overridden by `inputs`. */
export function withDefaults(machine: Machine, inputs: Inputs = {}): Inputs {
  const out: Inputs = {};
  for (const input of machine.inputs ?? []) out[input.name] = input.value;
  return { ...out, ...inputs };
}

function passes(guard: Guard, inputs: Inputs): boolean {
  const value = inputs[guard.inputName];
  const to = guard.compareTo;
  switch (guard.conditionType) {
    case "Equal":
      return value === to;
    case "NotEqual":
      return value !== to;
    case "GreaterThan":
      return (value as number) > (to as number);
    case "GreaterThanOrEqual":
      return (value as number) >= (to as number);
    case "LessThan":
      return (value as number) < (to as number);
    case "LessThanOrEqual":
      return (value as number) <= (to as number);
  }
}

export interface Step {
  state: MachineState;
  /** Seconds to cross-fade into `state`; 0 for a cut. */
  tween: number;
}

/**
 * Where the machine settles from `from` under `inputs`: follows every
 * transition whose guards all pass, until none does. Bounded by the state
 * count, so a file whose guards form a cycle cannot hang the app.
 */
export function settle(machine: Machine, from: string, inputs: Inputs): Step {
  const byName = new Map(machine.states.map((s) => [s.name, s]));
  let state = byName.get(from) ?? machine.states[0];
  let tween = 0;
  for (let hops = 0; hops < machine.states.length; hops++) {
    const next = state.transitions?.find((t) =>
      (t.guards ?? []).every((g) => passes(g, inputs)),
    );
    const target = next && byName.get(next.toState);
    if (!next || !target || target === state) break;
    state = target;
    tween = next.type === "Tweened" ? (next.duration ?? 0) : 0;
  }
  return { state, tween };
}

/**
 * How to play a `Tweened` transition from one segment to another.
 *
 * Blooby bakes each tween into the timeline: the frames between two adjacent
 * segments are the morph from the first state's pose into the second's (9
 * frames, the file's 300ms at 30fps). So going to the next segment plays that
 * gap forwards, and going back to the previous one plays it backwards; both
 * end on a pose the looping segment starts from.
 *
 * Returns the frames to play, `from` → `to`, or null for a cut: no tween, or
 * the segments aren't neighbours (a gap much longer than the tween belongs to
 * some other pair of states).
 */
export function bridge(
  prev: [number, number],
  next: [number, number],
  tweenSeconds: number,
  fps: number,
): { from: number; to: number } | null {
  if (tweenSeconds <= 0) return null;
  // A frame of slack for rounding in the export.
  const longest = Math.ceil(tweenSeconds * fps) + 1;
  const forward = next[0] - prev[1];
  if (forward > 0 && forward <= longest) return { from: prev[1], to: next[0] };
  const backward = prev[0] - next[1];
  if (backward > 0 && backward <= longest)
    return { from: prev[0], to: next[1] };
  return null;
}
