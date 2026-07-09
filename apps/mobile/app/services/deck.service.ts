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

export const deckService: IDeckService = {
  getDecks: async (): Promise<DeckItem[]> => {
    try {
      const response = await apiClient.get<DeckItem[]>("/api/v1/decks");
      return response.data;
    } catch (e: any) {
      console.log("getDecks error", e.response?.data, e.response?.status);
      throw e;
    }
  },

  getDeck: async (id: string): Promise<DeckItem> => {
    try {
      const response = await apiClient.get<DeckItem>(`/api/v1/decks/${id}`);
      return response.data;
    } catch (e: any) {
      console.log("getDeck error", e.response?.data, e.response?.status);
      throw e;
    }
  },

  createDeck: async (payload: DeckCreateParams): Promise<DeckItem> => {
    try {
      const response = await apiClient.post<DeckItem>("/api/v1/decks", payload);
      return response.data;
    } catch (e: any) {
      console.log("createDeck error", e.response?.data, e.response?.status);
      throw e;
    }
  },

  updateDeck: async (
    id: string,
    payload: DeckUpdateParams,
  ): Promise<DeckItem> => {
    try {
      // was "/api/v1/deck/${id}" (singular) — didn't match getDeck's route
      const response = await apiClient.patch<DeckItem>(
        `/api/v1/decks/${id}`,
        payload,
      );
      return response.data;
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

  toggleFavourite: async (id: string): Promise<DeckItem> => {
    const deck = await deckService.getDeck(id);
    return deckService.updateDeck(id, { isFavourite: !deck.isFavourite });
  },
};
