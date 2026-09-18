/**
 * The overscroll curve, checked.
 *
 *   node --experimental-strip-types scripts/check-reel.mjs
 *
 * It runs on the UI thread inside a worklet where nothing is observable, so the
 * properties that make it feel right are asserted here instead: no seam at the
 * bound, no second wall past it, and no way to escape the give.
 */
import assert from "node:assert/strict";

import { pageTarget, resist, rubberBand } from "../app/screens/daily-practice/reel.ts";

const GIVE = 0.6;
const LOWER = 0;
const UPPER = 4; // a five-paragraph snippet

// In range, the text tracks the finger exactly.
for (const v of [0, 0.25, 1, 2.5, 3.999, 4]) {
  assert.equal(rubberBand(v, LOWER, UPPER, GIVE), v, `identity inside bounds at ${v}`);
}

// No seam: resistance starts at 1:1, so there is no visible kink where it
// begins. (Slope at zero is exactly 1; sampled just past the bound.)
const eps = 1e-6;
const slopeAtBound = (rubberBand(UPPER + eps, LOWER, UPPER, GIVE) - UPPER) / eps;
assert.ok(Math.abs(slopeAtBound - 1) < 1e-4, `slope at the bound is ${slopeAtBound}, want 1`);

// Monotonic and strictly decelerating: every extra point of drag moves the text
// less than the one before, and never moves it backwards.
let previous = UPPER;
let previousStep = Infinity;
for (let drag = 0.05; drag <= 20; drag += 0.05) {
  const here = rubberBand(UPPER + drag, LOWER, UPPER, GIVE);
  const step = here - previous;
  assert.ok(step > 0, `not monotonic at +${drag.toFixed(2)}`);
  assert.ok(step < previousStep + 1e-12, `resistance eased off at +${drag.toFixed(2)}`);
  previous = here;
  previousStep = step;
}

// Asymptotic: no matter how hard it is dragged, it never reaches the give — so
// there is no second wall to hit further out.
for (const drag of [1, 10, 100, 10_000]) {
  const past = rubberBand(UPPER + drag, LOWER, UPPER, GIVE) - UPPER;
  assert.ok(past < GIVE, `overscroll ${past} reached the ${GIVE} give at +${drag}`);
}
assert.ok(rubberBand(UPPER + 10_000, LOWER, UPPER, GIVE) - UPPER > GIVE * 0.99,
  "should approach the give asymptotically");

// Symmetric at the other end — the first paragraph has to feel like the last.
for (const drag of [0.1, 1, 10]) {
  const below = LOWER - rubberBand(LOWER - drag, LOWER, UPPER, GIVE);
  const above = rubberBand(UPPER + drag, LOWER, UPPER, GIVE) - UPPER;
  assert.ok(Math.abs(below - above) < 1e-12, `asymmetric at ${drag}`);
}

// Degenerate inputs: a one-paragraph snippet has lower === upper, and both ends
// still have to give rather than lock.
assert.ok(rubberBand(0.4, 0, 0, GIVE) > 0 && rubberBand(0.4, 0, 0, GIVE) < GIVE);
assert.equal(resist(-1, GIVE), 0);
assert.equal(resist(1, 0), 0);

/* ------------------------------------------------------- paging, not throwing */

const COMMIT = 0.28;
const FLICK = 1.5;
const LAST = 4;
const page = (base, position, velocity) =>
  pageTarget(base, position, velocity, LAST, COMMIT, FLICK);

// The whole point: no velocity, at any magnitude, moves more than one paragraph.
for (const velocity of [2, 5, 20, 400, -3, -50, -9999]) {
  for (const base of [0, 1, 2, 3, 4]) {
    // Position is bounded to base ± 1 by the drag itself; test the extremes.
    for (const position of [base - 1, base, base + 1]) {
      const target = page(base, position, velocity);
      assert.ok(Math.abs(target - base) <= 1,
        `velocity ${velocity} moved ${Math.abs(target - base)} lines from ${base}`);
      assert.ok(target >= 0 && target <= LAST, `target ${target} out of range`);
      assert.equal(target, Math.round(target), `target ${target} is not a paragraph`);
    }
  }
}

// Below the threshold and without a flick, it goes back where it came from.
assert.equal(page(2, 2.2, 0), 2, "a nudge should not commit");
assert.equal(page(2, 1.8, 0), 2, "a nudge back should not commit");
// Past the threshold it advances exactly one.
assert.equal(page(2, 2.4, 0), 3);
assert.equal(page(2, 1.6, 0), 1);
// A flick commits on its own, from a standstill.
assert.equal(page(2, 2.01, 3), 3, "a flick forward should advance");
assert.equal(page(2, 1.99, -3), 1, "a flick back should retreat");
// A flick outranks distance, so a started gesture can be taken back.
assert.equal(page(2, 2.9, -4), 1, "flicking back past the threshold should reverse");
// The ends hold.
assert.equal(page(0, -1, -50), 0, "cannot go before the first paragraph");
assert.equal(page(LAST, LAST + 1, 50), LAST, "cannot go past the last");
// A one-paragraph snippet has nowhere to go.
assert.equal(pageTarget(0, 0.9, 10, 0, COMMIT, FLICK), 0);

console.log("ALL CHECKS PASSED");
