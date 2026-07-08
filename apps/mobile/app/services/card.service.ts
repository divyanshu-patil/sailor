import { apiClient } from "@/lib/api/client";
import {
  CardCreateParams,
  CardItem,
  CardUpdateParams,
  ICardService,
} from "@/types/presentation/card";

// Re-exported so `import { CardItem } from "@/services/card.service"`
// call sites work unchanged, same convention as deck.service.ts.
export * from "@/types/presentation/card";

export const cardService: ICardService = {
  getCards: async (deckId: string): Promise<CardItem[]> => {
    try {
      const response = await apiClient.get<CardItem[]>(
        `/api/v1/decks/${deckId}/cards`,
      );
      return response.data;
    } catch (e: any) {
      console.log("getCards error", e.response?.data, e.response?.status);
      throw e;
    }
  },

  getCard: async (deckId: string, id: string): Promise<CardItem> => {
    try {
      const response = await apiClient.get<CardItem>(
        `/api/v1/decks/${deckId}/cards/${id}`,
      );
      return response.data;
    } catch (e: any) {
      console.log("getCard error", e.response?.data, e.response?.status);
      throw e;
    }
  },

  createCard: async (
    deckId: string,
    payload: CardCreateParams,
  ): Promise<CardItem> => {
    try {
      const response = await apiClient.post<CardItem>(
        `/api/v1/decks/${deckId}/cards`,
        payload,
      );
      return response.data;
    } catch (e: any) {
      console.log("createCard error", e.response?.data, e.response?.status);
      throw e;
    }
  },

  updateCard: async (
    deckId: string,
    id: string,
    payload: CardUpdateParams,
  ): Promise<CardItem> => {
    try {
      const response = await apiClient.patch<CardItem>(
        `/api/v1/decks/${deckId}/cards/${id}`,
        payload,
      );
      return response.data;
    } catch (e: any) {
      console.log("updateCard error", e.response?.data, e.response?.status);
      throw e;
    }
  },

  deleteCard: async (deckId: string, id: string): Promise<void> => {
    try {
      await apiClient.delete(`/api/v1/decks/${deckId}/cards/${id}`);
    } catch (e: any) {
      console.log("deleteCard error", e.response?.data, e.response?.status);
      throw e;
    }
  },

  reorderCards: async (
    deckId: string,
    orderedIds: string[],
  ): Promise<CardItem[]> => {
    try {
      // Assumes backend accepts an ordered id list and returns cards re-sorted.
      // Adjust the payload shape once your teammate finalizes this endpoint.
      const response = await apiClient.patch<CardItem[]>(
        `/api/v1/decks/${deckId}/cards/reorder`,
        { orderedIds },
      );
      return response.data;
    } catch (e: any) {
      console.log("reorderCards error", e.response?.data, e.response?.status);
      throw e;
    }
  },
};
