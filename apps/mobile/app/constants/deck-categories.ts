/**
 * The curated category list, mirroring DeckCategory in
 * app/utils/enums/deck_enums.py. Closed on purpose: the discover filter is only
 * usable if everyone files decks under the same handful of headings — tags are
 * where free-text expressiveness lives.
 *
 * The `value`s are what the API stores, so renaming a label here is safe and
 * renaming a value is a migration.
 */
export const DECK_CATEGORIES = [
  { value: "interview", label: "Interview", symbol: "person.text.rectangle" },
  { value: "sales", label: "Sales & Pitch", symbol: "chart.line.uptrend.xyaxis" },
  { value: "academic", label: "Academic", symbol: "graduationcap" },
  { value: "business", label: "Business", symbol: "briefcase" },
  { value: "conference", label: "Conference & Talk", symbol: "megaphone" },
  { value: "social", label: "Wedding & Social", symbol: "heart" },
  { value: "teaching", label: "Education & Teaching", symbol: "books.vertical" },
  { value: "other", label: "Other", symbol: "ellipsis.circle" },
] as const;

export type DeckCategory = (typeof DECK_CATEGORIES)[number]["value"];

export const categoryLabel = (value?: string | null): string =>
  DECK_CATEGORIES.find((category) => category.value === value)?.label ?? "";

export const categorySymbol = (value?: string | null): string =>
  DECK_CATEGORIES.find((category) => category.value === value)?.symbol ??
  "square.grid.2x2";

/** Suggested tags in the publish sheet. Not a whitelist — the sheet also takes
 *  free text — just the shortcuts that cover most decks. */
export const SUGGESTED_TAGS = [
  "interview",
  "pitch",
  "keynote",
  "demo",
  "lecture",
  "workshop",
  "toast",
  "product",
  "research",
  "storytelling",
] as const;
