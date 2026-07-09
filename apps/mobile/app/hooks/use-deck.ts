import { useCallback, useEffect } from "react";
import { deckService, DeckItem, DeckUpdateParams } from "@/services/deck.debug.service";
import { useApiState, UseApiStateReturn } from "./use-api-state";

export interface UseDeckOptions {
  /** The deck ID to fetch */
  deckId: string;
  /** Initial data to set */
  initialData?: DeckItem;
  /** Callback on successful fetch */
  onSuccess?: (data: DeckItem) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
  /** Number of retry attempts on failure */
  retryCount?: number;
  /** Delay between retries in ms */
  retryDelay?: number;
  /** Auto-fetch deck on mount */
  immediate?: boolean;
}

export interface UseDeckReturn extends UseApiStateReturn<DeckItem> {
  /** Fetch the deck */
  fetchDeck: () => Promise<void>;
  /** Update the deck */
  updateDeck: (payload: DeckUpdateParams) => Promise<DeckItem | undefined>;
  /** Delete the deck */
  deleteDeck: () => Promise<void | undefined>;
  /** Toggle deck favorite status */
  toggleFavourite: () => Promise<DeckItem | undefined>;
}

/**
 * Hook for managing a single deck.
 * Provides loading, error, and mutation states along with CRUD operations.
 */
export function useDeck(options: UseDeckOptions): UseDeckReturn {
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
    isMutating,
    error,
    execute,
    refresh,
    clearError,
    setData,
  } = useApiState<DeckItem>({
    initialData,
    onSuccess,
    onError,
    retryCount,
    retryDelay,
  });

  const fetchDeck = useCallback(async () => {
    await execute(deckService.getDeck(deckId));
  }, [execute, deckId]);

  const updateDeck = useCallback(
    async (payload: DeckUpdateParams): Promise<DeckItem | undefined> => {
      const result = await execute(deckService.updateDeck(deckId, payload));
      if (result) {
        setData(result);
      }
      return result;
    },
    [execute, deckId, setData],
  );

  const deleteDeck = useCallback(async (): Promise<void | undefined> => {
    try {
      await deckService.deleteDeck(deckId);
    } catch {
      return undefined;
    }
  }, [deckId]);

  const toggleFavourite = useCallback(async (): Promise<DeckItem | undefined> => {
    const result = await execute(deckService.toggleFavourite(deckId));
    if (result) {
      setData(result);
    }
    return result;
  }, [execute, deckId, setData]);

  // Auto-fetch on mount if immediate is true
  useEffect(() => {
    if (immediate && deckId && !data && !isLoading && !error) {
      fetchDeck();
    }
  }, [immediate, deckId, data, isLoading, error, fetchDeck]);

  return {
    data,
    isLoading,
    isRefreshing,
    isMutating,
    error,
    execute,
    refresh: fetchDeck,
    clearError,
    setData,
    fetchDeck,
    updateDeck,
    deleteDeck,
    toggleFavourite,
  };
}