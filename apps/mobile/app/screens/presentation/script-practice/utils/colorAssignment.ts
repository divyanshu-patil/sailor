import { CardItem } from "@/services/card.service";

export const IMPACT_PALETTES = [
  ["#C9E4DE", "#B8E0D2", "#CDE7E0", "#D6EAE3"],
  ["#A0D2DB", "#B5E2EE", "#C2E7F0", "#AED9E0"],
  ["#FFE8B6", "#FFEFC3", "#FCE8A6", "#FFE5A0"],
  ["#FFC8A2", "#FFD3B0", "#FFCBA4", "#FCC9A6"],
  ["#F7A7A6", "#F8B4B3", "#F9ACAB", "#F6A0A3"],
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

/**
 * Buckets cards into 5 quantiles by impact score, then gives each card a shade
 * from that quantile's palette.
 *
 * The shade is picked from the card's id, not at random: the deck is re-read
 * from SQLite whenever the cards table changes (the mount refresh, an edit),
 * and a random pick meant every one of those re-reads repainted the whole deck
 * in front of the user.
 */
export const assignColorsByQuantile = (cards: CardItem[]) => {
  const sorted = [...cards].sort((a, b) => a.impact - b.impact);
  const bucketSize = Math.ceil(sorted.length / 5);
  const colorById = new Map<string, string>();
  sorted.forEach((card, i) => {
    const bucketIndex = Math.min(Math.floor(i / bucketSize), 4);
    const palette = IMPACT_PALETTES[bucketIndex];
    colorById.set(card.id, palette[hashId(card.id) % palette.length]);
  });
  return cards.map((card) => ({ ...card, color: colorById.get(card.id)! }));
};
