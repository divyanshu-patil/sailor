/**
 * Proves the card's colour and its haptic can never disagree.
 *
 *   node scripts/check-haptics.mjs
 *
 * One number — the impact tier — picks both the card's palette and the preset
 * that plays when it arrives. That only holds while three things stay true, and
 * none of them is visible to tsc or lint:
 *
 *   1. Every tier has a palette AND a haptic. Add a sixth threshold and forget
 *      the palette and the practice screen renders `undefined` as a background.
 *   2. The colour ramp is monotonic. Lightness must fall and saturation must
 *      rise across the tiers, or the deck stops reading as an intensity ladder
 *      and the thing the haptics are agreeing with is no longer there. This is
 *      the check the palette it replaced would have failed.
 *   3. Card text stays legible on every shade. ScriptLine derives it as
 *      `darken(0.4).desaturate(0.3)` at 30pt, which WCAG treats as large text:
 *      3:1. The previous tier-2 sand sat at 2.05:1.
 *
 * Tier boundaries and the preset ladder are read out of the source rather than
 * restated here, so this fails when the real thing changes instead of drifting
 * quietly alongside it.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const COLOURS = readFileSync(
  resolve(ROOT, "app/screens/presentation/script-practice/utils/colorAssignment.ts"),
  "utf8",
);
const HAPTICS = readFileSync(resolve(ROOT, "app/lib/haptics.ts"), "utf8");

let checks = 0;

/* ------------------------------------------------------------ source facts */

const thresholds = JSON.parse(
  COLOURS.match(/IMPACT_TIER_THRESHOLDS = (\[[^\]]*\])/)[1].replace(/\s/g, ""),
);
const palettes = COLOURS.match(/IMPACT_PALETTES = \[([\s\S]*?)\n\];/)[1]
  .split("\n")
  .map((line) => line.match(/"#[0-9A-Fa-f]{6}"/g))
  .filter(Boolean)
  .map((row) => row.map((c) => c.replace(/"/g, "")));
const tierHaptics = HAPTICS.match(/CARD_TIER_HAPTICS = \[([\s\S]*?)\n\] as const;/)[1]
  .split("\n")
  .map((l) => l.match(/weight\.(\w+)/))
  .filter(Boolean)
  .map((m) => m[1]);

/* ------------------------------------------------------------------ colour */

const hsl = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { s: s * 100, l: l * 100 };
};
const srgb = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
/** colord's `darken(0.4).desaturate(0.3)`, the transform ScriptLine applies. */
const inkFor = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  const d = max - min;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  h *= 60;
  if (h < 0) h += 360;
  const l0 = (max + min) / 2;
  const s0 = d === 0 ? 0 : d / (1 - Math.abs(2 * l0 - 1));
  const l = Math.max(0, l0 - 0.4);
  const s = Math.max(0, s0 - 0.3);
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const seg = [
    [c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x],
  ][Math.floor(h / 60) % 6];
  const hex2 = (v) =>
    Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${seg.map(hex2).join("")}`;
};

/* ------------------------------------------------------------------ checks */

const tiers = thresholds.length + 1;

assert.equal(palettes.length, tiers,
  `${tiers} tiers but ${palettes.length} palettes`);
checks++;
assert.equal(tierHaptics.length, tiers,
  `${tiers} tiers but ${tierHaptics.length} card haptics`);
checks++;

// Thresholds ascending, or getImpactTier's linear scan returns the wrong rung.
for (let i = 1; i < thresholds.length; i++) {
  assert.ok(thresholds[i] > thresholds[i - 1],
    `thresholds must ascend: ${thresholds}`);
  checks++;
}

// Every haptic named for a tier is a real rung of the weight ladder.
for (const name of tierHaptics) {
  assert.ok(new RegExp(`^\\s{2}${name}: \\(\\) => \\{`, "m").test(HAPTICS),
    `CARD_TIER_HAPTICS names weight.${name}, which is not in the ladder`);
  checks++;
}

// The ramp: lightness falls, saturation rises.
const mean = (row, key) => row.reduce((a, c) => a + hsl(c)[key], 0) / row.length;
for (let i = 1; i < palettes.length; i++) {
  assert.ok(mean(palettes[i], "l") < mean(palettes[i - 1], "l"),
    `tier ${i} is not darker than tier ${i - 1} — the ramp does not read as intensity`);
  checks++;
  assert.ok(mean(palettes[i], "s") > mean(palettes[i - 1], "s"),
    `tier ${i} is not more saturated than tier ${i - 1}`);
  checks++;
}

// Legibility on every shade of every tier.
for (const [i, row] of palettes.entries()) {
  for (const shade of row) {
    const ratio = contrast(shade, inkFor(shade));
    assert.ok(ratio >= 3,
      `tier ${i} ${shade}: card text is ${ratio.toFixed(2)}:1, under the 3:1 floor for 30pt`);
    checks++;
  }
}

// getImpactTier's contract: 0..1 in, a tier with a palette and a haptic out.
const tierOf = (impact) => {
  let t = 0;
  for (let i = 0; i < thresholds.length; i++) if (impact >= thresholds[i]) t = i + 1;
  return t;
};
for (let impact = 0; impact <= 1.0001; impact += 0.01) {
  const t = tierOf(Math.min(impact, 1));
  assert.ok(t >= 0 && t < tiers, `impact ${impact} produced tier ${t}`);
  assert.ok(palettes[t] && tierHaptics[t], `tier ${t} is missing a palette or a haptic`);
  checks++;
}
// The generator is told to reserve >0.8 for standout moments; that has to be
// the rung the loudest pattern is on, or the instruction and the feel diverge.
assert.equal(tierOf(0.81), tiers - 1, "impact above 0.8 must land on the top tier");
checks++;
assert.equal(tierOf(0.5), 2, "the generator's DEFAULT_IMPACT of 0.5 must land mid-ladder");
checks++;

console.log(`ALL CHECKS PASSED (${checks})`);
