import { apiClient } from "@/lib/api/client";

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

interface DeckUpdateParams {
  title: string;
  description: string;
  color: string;
  isFavourite?: boolean;
}

export const deckService = {
  getDeck: async (id: number): Promise<DeckItem> => {
    try {
      const response = await apiClient.get<DeckItem>(`/api/v1/decks/${id}`);
      console.log("Deck response", response.data);
      return response.data;
    } catch (e: any) {
      console.log("profile error", e.response?.data, e.response?.status);
      throw e;
    }
  },

  updateDeck: async (
    id: number,
    payload: DeckUpdateParams,
  ): Promise<DeckItem> => {
    const response = await apiClient.patch<DeckItem>(
      `/api/v1/deck/${id}`,
      payload,
    );
    return response.data;
  },
};
