export type DeckItem = {
  id: string;
  title: string;
  description: string;
  color: string;
  updatedAt: Date;
  slideCount: number;
  durationMins: number;
  isFavourite?: boolean;
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
