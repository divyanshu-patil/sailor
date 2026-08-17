export type DeckItem = {
  id: string;
  title: string;
  description: string;
  color: string;
  /**
   * ISO-8601 string, not a Date.
   *
   * It's what the API sends, what SQLite stores, and what survives a round trip
   * through expo-router params — all three of which previously needed a
   * `new Date()` / `.toISOString()` conversion at a different boundary, and one
   * of them was missing: the deck list came back from the API as strings while
   * the sort helpers called `.getTime()` on them.
   *
   * ISO-8601 also sorts lexicographically in chronological order, so ordering
   * needs no parsing. Components that format it construct a Date at the point of
   * use.
   */
  updatedAt: string;
  slideCount: number;
  durationMins: number;
  isFavourite?: boolean;
  /** Publish state and the metadata behind it. Present on the detail endpoint
   *  only — the grid summary doesn't carry them, so they're optional rather
   *  than defaulted, and a missing value means "not loaded", not "not public". */
  isPublic?: boolean;
  tags?: string[];
  category?: string | null;
  practiceCount?: number;
  /** How many people have bookmarked it. Counted server-side from the saves
   *  themselves, so it doesn't drift the way a stored counter would. */
  saveCount?: number;
};

export interface DeckCreateParams {
  title: string;
  description: string;
  color: string;
}

export interface DeckUpdateParams {
  title?: string;
  description?: string;
  color?: string;
  isFavourite?: boolean;
}

/** What the publish review sheet collects. All three are required by the API —
 *  a deck in the feed without them isn't browsable. */
export interface DeckPublishParams {
  description: string;
  tags: string[];
  category: string;
}

// Both `deckService` (real) and `dummyDeckService` (mock) implement this,
// so screens can depend on the shape rather than on which one is active.
export interface IDeckService {
  getDecks(): Promise<DeckItem[]>;
  getDeck(id: string): Promise<DeckItem>;
  createDeck(payload: DeckCreateParams): Promise<DeckItem>;
  updateDeck(id: string, payload: DeckUpdateParams): Promise<DeckItem>;
  deleteDeck(id: string): Promise<void>;
  toggleFavourite(id: string): Promise<DeckItem>;
}
