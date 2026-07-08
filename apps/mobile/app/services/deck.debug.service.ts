import {
  DeckCreateParams,
  DeckItem,
  DeckUpdateParams,
  IDeckService,
} from "@/types/presentation/deck";

import { DATA } from "./dummyData/deck";

// Re-exported so existing `import { DeckItem } from "@/services/deck.service"`
// call sites keep working unchanged.
export * from "@/types/presentation/deck";

const FAKE_LATENCY_MS = 400;

const delay = <T>(value: T, ms: number = FAKE_LATENCY_MS): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

// In-memory working copy, so create/update/delete persist for the session
// without ever touching the original DATA export.
let decks: DeckItem[] = DATA.map((deck) => ({ ...deck }));

export const deckService: IDeckService = {
  getDecks: async (): Promise<DeckItem[]> => {
    return delay(decks.map((deck) => ({ ...deck })));
  },

  getDeck: async (id: string): Promise<DeckItem> => {
    const deck = decks.find((d) => d.id === id);
    if (!deck) throw new Error(`Deck ${id} not found`);
    return delay({ ...deck });
  },

  createDeck: async (payload: DeckCreateParams): Promise<DeckItem> => {
    const newDeck: DeckItem = {
      id: String(Date.now()),
      ...payload,
      updatedAt: new Date(),
      slideCount: 0,
      durationMins: 0,
      isFavourite: false,
    };
    decks = [newDeck, ...decks];
    return delay({ ...newDeck });
  },

  updateDeck: async (
    id: string,
    payload: DeckUpdateParams,
  ): Promise<DeckItem> => {
    const index = decks.findIndex((d) => d.id === id);
    if (index === -1) throw new Error(`Deck ${id} not found`);
    decks[index] = { ...decks[index], ...payload, updatedAt: new Date() };
    return delay({ ...decks[index] });
  },

  deleteDeck: async (id: string): Promise<void> => {
    decks = decks.filter((d) => d.id !== id);
    return delay(undefined);
  },

  toggleFavourite: async (id: string): Promise<DeckItem> => {
    const deck = decks.find((d) => d.id === id);
    if (!deck) throw new Error(`Deck ${id} not found`);
    return deckService.updateDeck(id, {
      isFavourite: !deck.isFavourite,
    });
  },
};
