/**
 * iOS-style overscroll resistance, in line units.
 *
 * Inside the bounds this is the identity — the text tracks the finger exactly.
 * Past them it keeps moving, but each further point of drag buys less travel,
 * approaching `give` and never reaching it. That is the difference between a
 * scroll that ends and one that stops: a hard clamp decouples the content from
 * the finger the instant it hits the limit, which reads as the gesture breaking
 * rather than as the list ending.
 *
 * `x / (1 + x / give)` is the same curve UIScrollView uses. Two properties earn
 * it: its slope at zero is exactly 1, so there is no seam where resistance
 * starts, and it is asymptotic, so there is no second wall further out.
 */
export function resist(overshoot: number, give: number): number {
  "worklet";
  if (overshoot <= 0 || give <= 0) return 0;
  return overshoot / (1 + overshoot / give);
}

export function rubberBand(
  value: number,
  lower: number,
  upper: number,
  give: number,
): number {
  "worklet";
  if (value < lower) return lower - resist(lower - value, give);
  if (value > upper) return upper + resist(value - upper, give);
  return value;
}

/**
 * Where a gesture settles: the paragraph it started on, or exactly one either
 * side of it. Never two.
 *
 * Projecting the throw — target = round(position + velocity × t) — is what a
 * scroll view does, and it is wrong here. A paragraph is a thing you read, not
 * a distance you travel, so a hard flick skipping past one is skipping content,
 * not moving faster. Velocity still decides *whether* to advance; it never
 * decides *how far*.
 *
 * @param base       the paragraph the gesture picked up from
 * @param position   where the reel is now, in line units
 * @param velocity   lines per second, positive to advance
 * @param last       index of the final paragraph
 */
export function pageTarget(
  base: number,
  position: number,
  velocity: number,
  last: number,
  commitFraction: number,
  flickVelocity: number,
): number {
  "worklet";
  const travelled = position - base;
  const flicked = Math.abs(velocity) > flickVelocity;
  // A flick outranks the distance: flicking back from beyond the threshold has
  // to return, or the gesture cannot be taken back once it has been started.
  const direction = flicked ? Math.sign(velocity) : Math.sign(travelled);
  const committed = flicked || Math.abs(travelled) > commitFraction;
  if (!committed || direction === 0) return base;
  return Math.min(Math.max(base + direction, 0), last);
}
