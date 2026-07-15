import { useCallback, useState } from "react";
import {
  deckService,
  DeckCreateParams,
  DeckItem,
  DeckUpdateParams,
} from "@/services/deck.debug.service";
import { useApiState, UseApiStateReturn } from "./use-api-state";

export interface UseDecksOptions {
  /** Initial data to set */
  initialData?: DeckItem[];
  /** Callback on successful fetch */
  onSuccess?: (data: DeckItem[]) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
  /** Number of retry attempts on failure */
  retryCount?: number;
  /** Delay between retries in ms */
  retryDelay?: number;
  /** Auto-fetch decks on mount */
  immediate?: boolean;
}

export interface UseDecksReturn extends UseApiStateReturn<DeckItem[]> {
  /** Fetch all decks */
  fetchDecks: () => Promise<void>;
  /** Create a new deck */
  createDeck: (payload: DeckCreateParams) => Promise<DeckItem | undefined>;
  /** Update a deck */
  updateDeck: (
    id: string,
    payload: DeckUpdateParams,
  ) => Promise<DeckItem | undefined>;
  /** Delete a deck */
  deleteDeck: (id: string) => Promise<void | undefined>;
  /** Toggle deck favorite status */
  toggleFavourite: (id: string) => Promise<DeckItem | undefined>;
  /** Whether a mutation is in progress */
  isMutating: boolean;
}

// hooks/use-decks.ts — add these exports (keep existing useDecks hook as-is)

export type DeckFilterType = "all" | "favourites";
export type DeckSortOption =
  | "dateCreated"
  | "nameAsc"
  | "nameDesc"
  | "duration"
  | "cardCount";

/**
 * Client-side filter + sort over an already-fetched decks array.
 *
 * TODO: once local DB (SQLite / WatermelonDB / etc.) is wired up as the
 * source of truth, replace the internals here with a real query
 * (e.g. `SELECT * FROM decks WHERE is_favourite = 1 ORDER BY ...`)
 * instead of filtering/sorting an in-memory array. Keep the signature
 * and return shape the same so callers (AllScriptsScreen, SearchScreen,
 * etc.) don't need to change when the swap happens.
 */
export function filterAndSortDecks(
  decks: DeckItem[],
  filter: DeckFilterType,
  sort: DeckSortOption,
): DeckItem[] {
  const filtered =
    filter === "favourites" ? decks.filter((deck) => deck.isFavourite) : decks;

  const sorted = [...filtered];

  switch (sort) {
    case "nameAsc":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case "nameDesc":
      return sorted.sort((a, b) => b.title.localeCompare(a.title));
    case "duration":
      return sorted.sort((a, b) => b.durationMins - a.durationMins);
    case "cardCount":
      return sorted.sort((a, b) => b.slideCount - a.slideCount);
    case "dateCreated":
    default:
      return sorted.sort(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
      );
  }
}

/**
 * Hook for managing deck list operations.
 * Provides loading, error, and refresh states along with CRUD operations.
 */
export function useDecks(options: UseDecksOptions = {}): UseDecksReturn {
  const {
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
  } = useApiState<DeckItem[]>({
    initialData,
    onSuccess,
    onError,
    retryCount,
    retryDelay,
  });

  const [isMutating, setIsMutating] = useState(false);

  const fetchDecks = useCallback(async () => {
    await execute(deckService.getDecks());
  }, [execute]);

  const createDeck = useCallback(
    async (payload: DeckCreateParams): Promise<DeckItem | undefined> => {
      setIsMutating(true);
      try {
        const result = await deckService.createDeck(payload);
        // Optimistically add to list
        setData((prev) => (prev ? [result, ...prev] : [result]));
        return result;
      } catch {
        return undefined;
      } finally {
        setIsMutating(false);
      }
    },
    [setData],
  );

  const updateDeck = useCallback(
    async (
      id: string,
      payload: DeckUpdateParams,
    ): Promise<DeckItem | undefined> => {
      setIsMutating(true);
      try {
        const result = await deckService.updateDeck(id, payload);
        // Optimistically update in list
        setData((prev) =>
          prev?.map((deck) => (deck.id === id ? result : deck)),
        );
        return result;
      } catch {
        return undefined;
      } finally {
        setIsMutating(false);
      }
    },
    [setData],
  );

  const deleteDeck = useCallback(
    async (id: string): Promise<void | undefined> => {
      setIsMutating(true);
      try {
        await deckService.deleteDeck(id);
        // Optimistically remove from list
        setData((prev) => prev?.filter((deck) => deck.id !== id));
      } catch {
        return undefined;
      } finally {
        setIsMutating(false);
      }
    },
    [setData],
  );

  const toggleFavourite = useCallback(
    async (id: string): Promise<DeckItem | undefined> => {
      setIsMutating(true);
      try {
        const result = await deckService.toggleFavourite(id);
        // Optimistically update in list
        setData((prev) =>
          prev?.map((deck) => (deck.id === id ? result : deck)),
        );
        return result;
      } catch {
        return undefined;
      } finally {
        setIsMutating(false);
      }
    },
    [setData],
  );

  // Auto-fetch on mount if immediate is true
  if (immediate && !data && !isLoading && !error) {
    fetchDecks();
  }

  return {
    data,
    isLoading,
    isRefreshing,
    isMutating,
    error,
    execute,
    refresh: fetchDecks,
    clearError,
    setData,
    fetchDecks,
    createDeck,
    updateDeck,
    deleteDeck,
    toggleFavourite,
  };
}
