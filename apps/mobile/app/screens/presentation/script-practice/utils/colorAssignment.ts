import { CardItem } from "@/services/card.service";

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
 * One palette per tier, four shades each.
 *
 * The ramp is monotonic in both directions that read as "weight": lightness
 * falls (87 → 82 → 77 → 72 → 67) and saturation climbs (30 → 44 → 62 → 76 → 84)
 * across the tiers, with the hue travelling cool to warm. That matters, because
 * the palette this replaces was monotonic in neither — its lightness ran
 * 84 → 80 → 84 → 83 → 82 and its saturation 35 → 53 → 98 → 98 → 84, which put
 * tiers 2 and 3 at an identical weight and made tier 4, the loudest card in the
 * deck, *less* saturated than the two below it. Colour simply was not encoding
 * intensity, so it could not agree with a haptic ladder that does.
 *
 * It also fixes a legibility bug. Card text is this colour darkened and
 * desaturated (see ScriptLine), and against the old tier-2 sand that came out at
 * 2.05:1 — under WCAG's 3:1 floor for large text, which 30pt is. Every tier here
 * clears it (3.35–3.79:1).
 *
 * Four shades rather than one so a deck does not look striped; they are a
 * visual tie-break within a tier, not a further intensity step, which is why
 * they share a lightness and saturation band.
 */
export const IMPACT_PALETTES = [
  ["#D9EAE6", "#D4E8E4", "#D7E8E6", "#CEE6E2"], // 0 · very mild  — ice
  ["#C2E0E7", "#BDDBE5", "#C1D9E5", "#B6D7E5"], // 1 · mild       — cool blue
  ["#EAD1A6", "#E9D3A0", "#E8D8A5", "#E9D298"], // 2 · moderate   — sand
  ["#EFA788", "#EEA981", "#ECB387", "#EFA678"], // 3 · strong     — amber
  ["#F2706B", "#F27264", "#EF816A", "#F46C5A"], // 4 · very strong— coral
];

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
 * Gives every card its impact tier, and a colour from that tier's palette.
 *
 * The shade is picked from the card's id, not at random: the deck is re-read
 * from SQLite whenever the cards table changes (the mount refresh, an edit),
 * and a random pick meant every one of those re-reads repainted the whole deck
 * in front of the user.
 *
 * `tier` rides along on the card so the swipe handler can play the matching
 * haptic without recomputing anything — and, more to the point, without being
 * able to disagree with what the card looks like.
 */
export const assignImpactColors = (cards: CardItem[]): TieredCard[] =>
  cards.map((card) => {
    const tier = getImpactTier(card.impact);
    const palette = IMPACT_PALETTES[tier]!;
    return { ...card, tier, color: palette[hashId(card.id) % palette.length]! };
  });
