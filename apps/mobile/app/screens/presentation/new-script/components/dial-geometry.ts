import { Dimensions } from "react-native";

const { width: W, height: WIN_H } = Dimensions.get("window");

/** Every arc and the focused ring share the screen's vertical axis. */
export const CX = W / 2;

/** Radius of the circle each band is a slice of. One screen width keeps the
 *  arc gentle — it sags about 55pt from the middle of the screen to the edge —
 *  and puts the centre of rotation far below the phone, which is what makes a
 *  sideways drag read as turning a large wheel rather than swiping a carousel. */
export const ARC_R = W;
/** The circle the option bubbles and the tick marks both sit on. */
export const ITEM_R = ARC_R - 74;
/** Points of finger travel per option on a collapsed arc — the knob for how
 *  fast the dials turn. The drag and the layout are the same angle, so this is
 *  also how far apart the options sit: lower it and a swipe covers more of a
 *  long list, at the cost of crowding the arc. */
export const STEP_TRAVEL = 106;
/** That travel as an angle, which is what everything downstream works in. */
export const STEP_C = STEP_TRAVEL / ITEM_R;

/** Radius of the focused ring. Proportional to the screen, like the arcs, so
 *  the dial fills the same share of a small phone and a large one. */
export const RING_R = Math.round(W * 0.4);
export const BUBBLE = 60;
export const ITEM_W = 96;

/** What a band's circle has to grow to before it covers the screen. Measured
 *  generously: the centre of the bottom band's circle sits a long way below the
 *  phone, so its reach to the far top corner is most of two screen diagonals. */
export const CIRCLE_R = Math.hypot(W, WIN_H) * 1.4;

/** Vertical distance between arcs. Shrinks on a short screen so the three bands
 *  never climb into the title. */
export function bandGap(height: number) {
  "worklet";
  return Math.min(152, height * 0.235);
}

/** The audience arc is pushed down by this much, which is room the mood dial
 *  in the middle gets back. */
const AUDIENCE_DROP = 24;

/** Y of band `k`'s arc at the middle of the screen. 0 is the top band.
 *
 *  Anchored to the top of the stack rather than the bottom: the bands are
 *  slices of circles far taller than the screen, so the fill runs off the
 *  bottom whatever happens, and what actually has to be held is the gap under
 *  the title — measuring up from the footer leaves a tall phone with a hole in
 *  the middle of the screen. */
export function arcTop(height: number, k: number) {
  "worklet";
  return height * 0.26 + k * bandGap(height) + (k === 2 ? AUDIENCE_DROP : 0);
}

/** Centre of band `k`'s circle. */
export function arcCenterY(height: number, k: number) {
  "worklet";
  return arcTop(height, k) + ARC_R;
}

/** Centre of the focused dial — a little below the middle, to leave the title
 *  and the description their own room above it. */
export function focusCenterY(height: number) {
  "worklet";
  return height * 0.56;
}

/**
 * Which band a point falls in, or -1 for the area above all three.
 *
 * Hit-tested against each arc rather than a bounding box: the boxes overlap,
 * and the top corners of a lower band sit over the band above it — where the
 * pixels under the finger belong to the band it isn't in.
 */
export function pickBand(height: number, x: number, y: number) {
  "worklet";
  const dx = x - CX;
  const dip = ARC_R - Math.sqrt(Math.max(0, ARC_R * ARC_R - dx * dx));
  for (let k = 2; k >= 0; k--) {
    if (y >= arcTop(height, k) + dip) return k;
  }
  return -1;
}

/** Radians between options once the dial is focused: a closed ring for a short
 *  list, a wide sweep with the far end faded out for a long one. */
export function ringStep(count: number) {
  "worklet";
  return (Math.PI * 2) / Math.min(count, 9);
}

/**
 * The shortest way round from the selection to option `index`, in options.
 *
 * The dials turn forever in both directions: `raw` is never clamped, and past
 * either end of a list the next option is the one that wrapped. So an option's
 * place on the dial is its distance the short way round — which is what makes
 * a long list close into a full ring instead of running out of screen.
 */
export function wrapD(d: number, count: number) {
  "worklet";
  const x = ((d % count) + count) % count;
  return x > count / 2 ? x - count : x;
}

/** Which option a continuous position lands on, brought back into range. */
export function wrapIndex(value: number, count: number) {
  "worklet";
  return ((Math.round(value) % count) + count) % count;
}

/** How far from the selection an option stays visible on the focused ring.
 *  A short list never reaches its own limit, so its ring is always closed; a
 *  long one shows the nine that fit and fades the rest out behind the bottom,
 *  which still reads as a full dial face rather than a fan. */
export function ringMaxD(count: number) {
  "worklet";
  return count <= 7 ? count : 4.5;
}
