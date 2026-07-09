import { CardItem } from "@/services/card.service";

export const IMPACT_PALETTES = [
  ["#C9E4DE", "#B8E0D2", "#CDE7E0", "#D6EAE3"],
  ["#A0D2DB", "#B5E2EE", "#C2E7F0", "#AED9E0"],
  ["#FFE8B6", "#FFEFC3", "#FCE8A6", "#FFE5A0"],
  ["#FFC8A2", "#FFD3B0", "#FFCBA4", "#FCC9A6"],
  ["#F7A7A6", "#F8B4B3", "#F9ACAB", "#F6A0A3"],
];

/**
 * Buckets cards into 5 quantiles by impact score, then assigns each card
 * a random color from that quantile's palette.
 */
export const assignColorsByQuantile = (cards: CardItem[]) => {
  const sorted = [...cards].sort((a, b) => a.impact - b.impact);
  const bucketSize = Math.ceil(sorted.length / 5);
  const colorById = new Map<string, string>();
  sorted.forEach((card, i) => {
    const bucketIndex = Math.min(Math.floor(i / bucketSize), 4);
    const palette = IMPACT_PALETTES[bucketIndex];
    colorById.set(card.id, palette[Math.floor(Math.random() * palette.length)]);
  });
  return cards.map((card) => ({ ...card, color: colorById.get(card.id)! }));
};
