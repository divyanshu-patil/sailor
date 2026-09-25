import { CardItem } from "@/services/card.service";

import { hexToOklch, oklchToHex } from "./oklch";

/**
 * Impact tiers — the single number behind both a card's colour and its haptic.
 *
 * Five buckets over the generator's 0..1 impact score. The top boundary is not
 * arbitrary: the card prompt tells the model to "reserve values above 0.8 for
 * genuinely standout moments (a key statistic, the emotional core, the call to
 * action), not every card", so 0.8 is where the model is already aiming when it
 * marks something as the peak of a script.
 *
 * These are *absolute* thresholds, and that is a deliberate change from the
 * rank-quantile bucketing this used to do. Quantiles put exactly a fifth of
 * every deck in the top bucket no matter what was in it — so a deck of uniformly
 * calm lines still got a scarlet "climax" card, directly contradicting the
 * instruction the generator was given. Harmless when it only tinted a card;
 * actively dishonest once it also decides how hard the phone hits you. A deck
 * of quiet cards should look quiet and feel quiet.
 */
export const IMPACT_TIER_THRESHOLDS = [0.2, 0.4, 0.6, 0.8] as const;

/** 0 (very mild) … 4 (very strong) for a 0..1 impact score. */
export const getImpactTier = (impact: number) => {
  "worklet";
  const safe = Number.isFinite(impact) ? impact : 0.5;
  let tier = 0;
  for (let i = 0; i < IMPACT_TIER_THRESHOLDS.length; i++) {
    if (safe >= IMPACT_TIER_THRESHOLDS[i]!) tier = i + 1;
  }
  return tier;
};

/**
 * A card's colour, generated in OKLCH from its impact.
 *
 * Built on what colour-emotion research agrees on. Saturation drives arousal
 * and brightness drives pleasantness — Valdez & Mehrabian (1994) fit
 * Arousal = −.31·Brightness + .60·Saturation and Pleasure = .69·B + .22·S, and
 * Wilms & Oberfeld (2018) found saturated colours most arousing, red most of
 * all. So impact is carried mostly by chroma, rising 0.05 → 0.14; lightness
 * eases down only a little (0.91 → 0.76), which keeps every card a bright,
 * pleasant pastel; and the hue travels from cool to warm along the app's own
 * pastels — mint, sky, the brand lavender, pink, coral. The path goes the long
 * way round, through blue and purple, so it never passes the yellow–sand that
 * both reads least pleasant and all but disappears into the cream page (the old
 * "moderate" tier did).
 *
 * OKLCH rather than hand-tuned HSL because its steps are perceptually even:
 * the ramp is monotonic in how cards look, not just in their numbers. It's
 * continuous in impact, so a stronger line is always a more vivid card, and
 * `getImpactTier` — the same impact through fixed thresholds — can never
 * disagree with it about which of two cards hits harder.
 */
const RAMP = {
  lightness: [0.91, 0.76],
  chroma: [0.05, 0.14],
  /** Calm → peak. 385° is coral (25°), written past 360 so the path keeps
   *  turning the same way. */
  hues: [165, 235, 292, 345, 385],
} as const;

/** How far a card's hue may drift from the ramp, so cards with the same impact
 *  — the model repeats values — don't come out identical. */
const HUE_JITTER = 7;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The ramp's hue at `t`, 0–1. */
const hueAt = (t: number) => {
  const { hues } = RAMP;
  const x = t * (hues.length - 1);
  const i = Math.min(Math.floor(x), hues.length - 2);
  return lerp(hues[i]!, hues[i + 1]!, x - i);
};

/** The colour for a 0..1 impact; `seed` nudges the hue a few degrees. */
export const impactColor = (impact: number, seed = 0) => {
  const t = Math.min(1, Math.max(0, Number.isFinite(impact) ? impact : 0.5));
  const jitter = (seed % (HUE_JITTER * 2 + 1)) - HUE_JITTER;
  return oklchToHex({
    l: lerp(RAMP.lightness[0], RAMP.lightness[1], t),
    c: lerp(RAMP.chroma[0], RAMP.chroma[1], t),
    h: (hueAt(t) + jitter + 360) % 360,
  });
};

/**
 * The text colour for a card: its own hue, dark, with a little of its colour
 * kept. Derived in OKLCH so the contrast is even across the ramp — 3.9:1 on the
 * brightest coral to 6.5:1 on mint, all over WCAG's 3:1 for large text (card
 * text is 30pt). The HSL darken it replaces ran from a failing 2.75:1 on pale
 * cards to 5.3:1, and drained the calmest ones to plain grey.
 */
export const cardInk = (color: string) => {
  const { c, h } = hexToOklch(color);
  return oklchToHex({ l: 0.42, c: Math.min(c * 0.7, 0.085), h });
};

/** Stable 32-bit hash of a card id, so the shade a card gets is a property of
 *  the card rather than of when it happened to be read. */
const hashId = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

export type TieredCard = CardItem & { tier: number };

/**
 * Gives every card its impact tier, and its colour on the impact ramp.
 *
 * The hue nudge comes from the card's id, not at random: the deck is re-read
 * from SQLite whenever the cards table changes (the mount refresh, an edit),
 * and a random pick meant every one of those re-reads repainted the whole deck
 * in front of the user.
 *
 * `tier` rides along on the card so the swipe handler can play the matching
 * haptic without recomputing anything — and, more to the point, without being
 * able to disagree with what the card looks like.
 */
export const assignImpactColors = (cards: CardItem[]): TieredCard[] =>
  cards.map((card) => ({
    ...card,
    tier: getImpactTier(card.impact),
    color: impactColor(card.impact, hashId(card.id)),
  }));
