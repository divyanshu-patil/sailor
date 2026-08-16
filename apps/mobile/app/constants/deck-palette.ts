/**
 * The app's deck palette — a mirror of `DECK_PALETTE` in
 * app/services/decks/deck_colors.py, which is where a deck's colour is actually
 * decided.
 *
 * The backend owns the assignment; this copy exists for the UI that needs a
 * deck-ish colour before (or without) a deck to take it from — the category
 * chips in Discover, for instance. Keep the two lists identical: a colour here
 * that the backend can't produce is a shade the deck surfaces were never
 * designed against, which is exactly what the muted palette exists to prevent.
 *
 * Ordered warm -> cool, so walking it hands neighbouring elements distinct hues.
 */
export const DECK_PALETTE = [
  "#F4D35E", // soft mustard — the app's accent
  "#FFC88A", // warm apricot
  "#F78199", // muted coral
  "#EFC1FF", // pale orchid
  "#A0A3FF", // periwinkle
  "#A1AFDE", // dusty blue
  "#ACCCC0", // sage
] as const;

/** Cycles the palette, so any indexable list of things gets stable, distinct
 *  pastels without a hand-maintained colour-per-item table. */
export const paletteColorAt = (index: number): string =>
  DECK_PALETTE[((index % DECK_PALETTE.length) + DECK_PALETTE.length) % DECK_PALETTE.length];
