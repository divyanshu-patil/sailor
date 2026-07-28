import { apiClient } from "@/lib/api/client";
import {
  DeckCreateParams,
  DeckItem,
  DeckUpdateParams,
  IDeckService,
} from "@/types/presentation/deck";

// Re-exported so existing `import { DeckItem } from "@/services/deck.service"`
// call sites keep working unchanged.
export * from "@/types/presentation/deck";

/**
 * The two deck endpoints return different shapes, and that difference used to be
 * papered over with a cast.
 *
 *  - `GET /decks`      -> AllDeckInfoResponse, already aliased to the app's
 *                         camelCase names (updatedAt, slideCount, ...).
 *  - `GET /decks/{id}` -> DeckResponse, straight off the SQLAlchemy model, so
 *                         snake_case (updated_at, card_count, is_favorite) plus
 *                         the script.
 *
 * `getDeck` was typed as returning DeckItem while actually handing back the
 * second shape, so `deck.slideCount` and `deck.updatedAt` were undefined at
 * runtime with no type error to show for it. The mapper below is the fix.
 */
interface DeckDetailResponse {
  id: number;
  user_id: number;
  title: string | null;
  description: string | null;
  script: string | null;
  color: string;
  duration_mins: number;
  card_count: number;
  is_favorite: boolean;
  generation_status: string;
  generation_error: string | null;
  created_at: string;
  updated_at: string;
}

/** `GET /decks` — AllDeckInfoResponse, serialised by field name (camelCase).
 *  No script and no created_at; the detail endpoint carries those. */
interface DeckSummaryResponse {
  id: number;
  title: string | null;
  description: string;
  color: string;
  updatedAt: string;
  slideCount: number;
  durationMins: number;
  isFavourite: boolean;
}

const toDeckItemFromSummary = (deck: DeckSummaryResponse): DeckItem => ({
  // String, not the raw number: the local `decks` primary key is TEXT, and the
  // detail endpoint's mapper already stringifies. Two id types for one deck is
  // how you end up with two rows for it.
  id: String(deck.id),
  title: deck.title ?? "",
  description: deck.description,
  color: deck.color,
  updatedAt: deck.updatedAt,
  slideCount: deck.slideCount,
  durationMins: deck.durationMins,
  isFavourite: deck.isFavourite,
});

const toDeckItem = (deck: DeckDetailResponse): DeckItem => ({
  id: String(deck.id),
  title: deck.title ?? "",
  description: deck.description ?? "",
  color: deck.color,
  updatedAt: deck.updated_at,
  slideCount: deck.card_count,
  durationMins: deck.duration_mins,
  isFavourite: deck.is_favorite,
});

/** Detail responses carry the script, which DeckItem doesn't model. Returned
 *  separately so the hook can store it without widening DeckItem. */
export interface DeckWithScript {
  deck: DeckItem;
  script: string | null;
  generationStatus: string;
  createdAt: string;
}

export const deckService: IDeckService & {
  getDeckDetail(id: string): Promise<DeckWithScript>;
} = {
  /**
   * The deck grid.
   *
   * Mapped explicitly rather than cast. This used to be
   * `apiClient.get<DeckItem[]>(...)` returning `response.data` untouched — a
   * cast that asserted a shape nobody checked. When the API turned out to be
   * serialising snake_case, every field silently became `undefined`: decks
   * rendered with 0 cards and a NaN duration, and `deck.id` (a number) went into
   * a TEXT primary key. A mapper fails loudly on a shape change; a cast doesn't
   * fail at all.
   */
  getDecks: async (): Promise<DeckItem[]> => {
    try {
      const response =
        await apiClient.get<DeckSummaryResponse[]>("/api/v1/decks");
      return response.data.map(toDeckItemFromSummary);
    } catch (e: any) {
      console.log("getDecks error", e.response?.data, e.response?.status);
      throw e;
    }
  },

  getDeck: async (id: string): Promise<DeckItem> => {
    const { deck } = await deckService.getDeckDetail(id);
    return deck;
  },

  getDeckDetail: async (id: string): Promise<DeckWithScript> => {
    try {
      const response = await apiClient.get<DeckDetailResponse>(
        `/api/v1/decks/${id}`,
      );
      return {
        deck: toDeckItem(response.data),
        script: response.data.script,
        generationStatus: response.data.generation_status,
        createdAt: response.data.created_at,
      };
    } catch (e: any) {
      console.log("getDeck error", e.response?.data, e.response?.status);
      throw e;
    }
  },

  /**
   * There is no POST /decks any more.
   *
   * A deck is only ever created from an accepted script, via
   * `scriptService.createDeck` — which is what keeps the grid free of the
   * card-less decks that the old "create the deck, then generate into it" flow
   * left behind. This stays to satisfy IDeckService and fails loudly rather than
   * quietly 405ing at runtime.
   */
  createDeck: async (_payload: DeckCreateParams): Promise<DeckItem> => {
    throw new Error(
      "Decks are created by accepting a script — call scriptService.createDeck(generationId).",
    );
  },

  updateDeck: async (
    id: string,
    payload: DeckUpdateParams,
  ): Promise<DeckItem> => {
    try {
      const response = await apiClient.patch<DeckDetailResponse>(
        `/api/v1/decks/${id}`,
        payload,
      );
      return toDeckItem(response.data);
    } catch (e: any) {
      console.log("updateDeck error", e.response?.data, e.response?.status);
      throw e;
    }
  },

  deleteDeck: async (id: string): Promise<void> => {
    try {
      await apiClient.delete(`/api/v1/decks/${id}`);
    } catch (e: any) {
      console.log("deleteDeck error", e.response?.data, e.response?.status);
      throw e;
    }
  },

  /**
   * Kept to satisfy the interface, but prefer the optimistic path in `useDecks`:
   * that flips SQLite first and PATCHes the resulting value, where this has to GET
   * the deck to learn the current flag before it can invert it — two round trips,
   * and a race if the deck changed in between.
   */
  toggleFavourite: async (id: string): Promise<DeckItem> => {
    const deck = await deckService.getDeck(id);
    return deckService.updateDeck(id, { isFavourite: !deck.isFavourite });
  },
};
