import { colord } from "colord";

/**
 * The tones a deck card is drawn in, derived from the deck's own colour.
 *
 * These exact derivations were already living in the deck-grid card; they moved
 * here so the discover feed and the publish preview render in the same shades
 * rather than each inventing its own darken/desaturate pair. The backend picks
 * the base colour from a fixed pastel palette (services/decks/deck_colors.py),
 * so every value below is guaranteed to sit on one of those seven.
 */
export interface DeckCardColors {
  /** Headline text. The darkest tone — it carries the contrast. */
  title: string;
  /** Secondary text, icons, meta rows. */
  accent: string;
  /** Filled chips and pills sitting on top of the card. */
  pill: string;
}

export function deckCardColors(color: string): DeckCardColors {
  return {
    title: colord(color).darken(0.5).toHex(),
    accent: colord(color).darken(0.35).desaturate(0.24).toHex(),
    pill: colord(color).lighten(0.08).desaturate(0.08).toHex(),
  };
}
