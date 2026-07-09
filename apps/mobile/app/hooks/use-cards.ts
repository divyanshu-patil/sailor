import { useCallback, useState } from "react";
import {
  cardService,
  CardCreateParams,
  CardItem,
  CardUpdateParams,
} from "@/services/card.debug.service";
import { useApiState, UseApiStateReturn } from "./use-api-state";

export interface UseCardsOptions {
  /** The deck ID to fetch cards from */
  deckId: string;
  /** Initial data to set */
  initialData?: CardItem[];
  /** Callback on successful fetch */
  onSuccess?: (data: CardItem[]) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
  /** Number of retry attempts on failure */
  retryCount?: number;
  /** Delay between retries in ms */
  retryDelay?: number;
  /** Auto-fetch cards on mount */
  immediate?: boolean;
}

export interface UseCardsReturn extends UseApiStateReturn<CardItem[]> {
  /** Fetch all cards for the deck */
  fetchCards: () => Promise<void>;
  /** Create a new card */
  createCard: (payload: CardCreateParams) => Promise<CardItem | undefined>;
  /** Update a card */
  updateCard: (id: string, payload: CardUpdateParams) => Promise<CardItem | undefined>;
  /** Delete a card */
  deleteCard: (id: string) => Promise<void | undefined>;
  /** Reorder cards */
  reorderCards: (orderedIds: string[]) => Promise<CardItem[] | undefined>;
  /** Whether a mutation is in progress */
  isMutating: boolean;
}

/**
 * Hook for managing cards within a deck.
 * Provides loading, error, and refresh states along with CRUD operations.
 */
export function useCards(options: UseCardsOptions): UseCardsReturn {
  const {
    deckId,
    initialData,
    onSuccess,
    onError,
    retryCount = 3,
    retryDelay = 1000,
    immediate = true,
  } = options;

  const {
    data,
    isLoading,
    isRefreshing,
    error,
    execute,
    refresh,
    clearError,
    setData,
  } = useApiState<CardItem[]>({
    initialData,
    onSuccess,
    onError,
    retryCount,
    retryDelay,
  });

  const [isMutating, setIsMutating] = useState(false);

  const fetchCards = useCallback(async () => {
    await execute(cardService.getCards(deckId));
  }, [execute, deckId]);

  const createCard = useCallback(
    async (payload: CardCreateParams): Promise<CardItem | undefined> => {
      setIsMutating(true);
      try {
        const result = await cardService.createCard(deckId, payload);
        setData((prev) => (prev ? [...prev, result] : [result]));
        return result;
      } catch {
        return undefined;
      } finally {
        setIsMutating(false);
      }
    },
    [deckId, setData],
  );

  const updateCard = useCallback(
    async (id: string, payload: CardUpdateParams): Promise<CardItem | undefined> => {
      setIsMutating(true);
      try {
        const result = await cardService.updateCard(deckId, id, payload);
        setData((prev) =>
          prev?.map((card) => (card.id === id ? result : card)),
        );
        return result;
      } catch {
        return undefined;
      } finally {
        setIsMutating(false);
      }
    },
    [deckId, setData],
  );

  const deleteCard = useCallback(
    async (id: string): Promise<void | undefined> => {
      setIsMutating(true);
      try {
        await cardService.deleteCard(deckId, id);
        setData((prev) => prev?.filter((card) => card.id !== id));
      } catch {
        return undefined;
      } finally {
        setIsMutating(false);
      }
    },
    [deckId, setData],
  );

  const reorderCards = useCallback(
    async (orderedIds: string[]): Promise<CardItem[] | undefined> => {
      setIsMutating(true);
      try {
        const result = await cardService.reorderCards(deckId, orderedIds);
        setData(result);
        return result;
      } catch {
        return undefined;
      } finally {
        setIsMutating(false);
      }
    },
    [deckId, setData],
  );

  // Auto-fetch on mount if immediate is true
  if (immediate && deckId && !data && !isLoading && !error) {
    fetchCards();
  }

  return {
    data,
    isLoading,
    isRefreshing,
    isMutating,
    error,
    execute,
    refresh: fetchCards,
    clearError,
    setData,
    fetchCards,
    createCard,
    updateCard,
    deleteCard,
    reorderCards,
  };
}