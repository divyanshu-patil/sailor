import {
  CardCreateParams,
  CardItem,
  CardUpdateParams,
  ICardService,
} from "@/types/presentation/card";
import { dummyScriptCards } from "./dummyData/cards";
export * from "@/types/presentation/card";

const DUMMY_DELAY_MS = 400;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Seed a color for each card since dummyScriptCards doesn't include one —
// mirrors what assignColorsByQuantile would eventually do server-side.
const FALLBACK_COLORS = ["#F4D35E", "#EE964B", "#F95738", "#0D3B66", "#5FA8D3"];

const seedCard = (
  card: (typeof dummyScriptCards)[number],
  index: number,
): CardItem => ({
  ...card,
  color: FALLBACK_COLORS[index % FALLBACK_COLORS.length],
});

// In-memory store keyed by deckId. Every deckId gets the same seeded card set
// so any script detail screen you navigate to has something to render.
const store = new Map<string, CardItem[]>();

const getOrSeedDeck = (deckId: string): CardItem[] => {
  if (!store.has(deckId)) {
    store.set(
      deckId,
      dummyScriptCards.map((c, i) => seedCard(c, i)),
    );
  }
  return store.get(deckId)!;
};

let idCounter = dummyScriptCards.length + 1;

export const cardService: ICardService = {
  getCards: async (deckId: string): Promise<CardItem[]> => {
    await delay(DUMMY_DELAY_MS);
    return structuredClone(getOrSeedDeck(deckId));
  },

  getCard: async (deckId: string, id: string): Promise<CardItem> => {
    await delay(DUMMY_DELAY_MS);
    const cards = getOrSeedDeck(deckId);
    const card = cards.find((c) => c.id === id);
    if (!card) throw new Error(`Card ${id} not found in deck ${deckId}`);
    return structuredClone(card);
  },

  createCard: async (
    deckId: string,
    payload: CardCreateParams,
  ): Promise<CardItem> => {
    await delay(DUMMY_DELAY_MS);
    const cards = getOrSeedDeck(deckId);
    const newCard: CardItem = {
      id: String(idCounter++),
      color:
        payload.color ?? FALLBACK_COLORS[cards.length % FALLBACK_COLORS.length],
      text: payload.text,
      reveal: payload.reveal,
      impact: payload.impact,
      delivery: payload.delivery,
    };
    cards.push(newCard);
    return structuredClone(newCard);
  },

  updateCard: async (
    deckId: string,
    id: string,
    payload: CardUpdateParams,
  ): Promise<CardItem> => {
    await delay(DUMMY_DELAY_MS);
    const cards = getOrSeedDeck(deckId);
    const index = cards.findIndex((c) => c.id === id);
    if (index === -1) throw new Error(`Card ${id} not found in deck ${deckId}`);
    cards[index] = { ...cards[index], ...payload };
    return structuredClone(cards[index]);
  },

  deleteCard: async (deckId: string, id: string): Promise<void> => {
    await delay(DUMMY_DELAY_MS);
    const cards = getOrSeedDeck(deckId);
    const index = cards.findIndex((c) => c.id === id);
    if (index === -1) throw new Error(`Card ${id} not found in deck ${deckId}`);
    cards.splice(index, 1);
  },

  reorderCards: async (
    deckId: string,
    orderedIds: string[],
  ): Promise<CardItem[]> => {
    await delay(DUMMY_DELAY_MS);
    const cards = getOrSeedDeck(deckId);
    const byId = new Map(cards.map((c) => [c.id, c]));
    const reordered = orderedIds
      .map((id) => byId.get(id))
      .filter((c): c is CardItem => Boolean(c));
    store.set(deckId, reordered);
    return structuredClone(reordered);
  },
};
