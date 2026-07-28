import { useCallback, useEffect, useRef, useState } from "react";
import {
  deckService,
  DeckCreateParams,
  DeckItem,
  DeckUpdateParams,
} from "@/services/deck.service";
import { subscribeToTables, TABLES } from "@/db";
import {
  DeckSortOption,
  deleteDeck as dbDeleteDeck,
  listDecks as dbListDecks,
  pruneDecksNotIn,
  setDeckFavourite,
  toggleDeckFavourite,
  upsertDecks,
} from "@/db/decks.repo";
import { deckItemToUpsert } from "@/db/mappers";

export type DeckFilterType = "all" | "favourites";
export type { DeckSortOption };

export interface UseDecksOptions {
  /** Callback on a successful refresh from the API. */
  onSuccess?: (data: DeckItem[]) => void;
  /** Callback when the API refresh fails. Local data stays on screen. */
  onError?: (error: Error) => void;
  /** Auto-refresh from the API on mount. */
  immediate?: boolean;
  filter?: DeckFilterType;
  sort?: DeckSortOption;
}

export interface UseDecksReturn {
  /** Always read from SQLite, so it's populated on the first frame after a cold
   *  start and never drops back to undefined during a refresh. */
  data: DeckItem[] | undefined;
  /** True only while the *first* read is in flight — before anything has been
   *  painted — not during a background refresh. */
  isLoading: boolean;
  isRefreshing: boolean;
  isMutating: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  fetchDecks: () => Promise<void>;
  createDeck: (payload: DeckCreateParams) => Promise<DeckItem | undefined>;
  updateDeck: (
    id: string,
    payload: DeckUpdateParams,
  ) => Promise<DeckItem | undefined>;
  deleteDeck: (id: string) => Promise<void>;
  toggleFavourite: (id: string) => Promise<boolean | undefined>;
  clearError: () => void;
}

/**
 * The deck grid's data source.
 *
 * Reads come from SQLite, writes go through the API — the shape the whole data
 * layer follows: service (pure HTTP) -> hook (orchestrates) -> db (what the UI
 * renders) -> UI. Two consequences worth knowing:
 *
 *  - The grid paints from disk immediately on launch, and an API refresh updates
 *    it underneath instead of replacing it with a spinner.
 *  - Filter and sort are SQL, so they stay correct as the deck count grows and
 *    never need the whole table in memory.
 *
 * The hook re-reads whenever anything writes to `decks`, so a mutation on another
 * screen shows up here without either screen knowing about the other.
 */
export function useDecks(options: UseDecksOptions = {}): UseDecksReturn {
  const {
    onSuccess,
    onError,
    immediate = true,
    filter = "all",
    sort = "dateCreated",
  } = options;

  const [data, setData] = useState<DeckItem[] | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Callbacks are read through refs so a caller passing inline closures — which
  // is every caller — can't retrigger the read effect on every render.
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  });

  const readFromDb = useCallback(async () => {
    const rows = await dbListDecks(sort, filter);
    setData(rows);
    setIsLoading(false);
  }, [sort, filter]);

  // Initial read, plus a re-read on any write to `decks`. This is the only path
  // that sets `data`, so the UI can never disagree with what's on disk.
  useEffect(() => {
    let active = true;
    const read = () => {
      readFromDb().catch(() => {
        if (active) setIsLoading(false);
      });
    };
    read();
    const unsubscribe = subscribeToTables([TABLES.decks], read);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [readFromDb]);

  const fetchDecks = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const decks = await deckService.getDecks();
      await upsertDecks(decks.map(deckItemToUpsert));
      // Anything on disk the server no longer has was deleted elsewhere, and
      // nothing else would ever remove it.
      await pruneDecksNotIn(decks.map((deck) => deck.id));
      onSuccessRef.current?.(decks);
    } catch (e: any) {
      setError(
        e?.response?.data?.detail || e?.message || "Couldn't refresh decks",
      );
      onErrorRef.current?.(e);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const createDeck = useCallback(
    async (payload: DeckCreateParams): Promise<DeckItem | undefined> => {
      setIsMutating(true);
      try {
        const deck = await deckService.createDeck(payload);
        await upsertDecks([deckItemToUpsert(deck)]);
        return deck;
      } catch (e: any) {
        setError(e?.message || "Couldn't create deck");
        return undefined;
      } finally {
        setIsMutating(false);
      }
    },
    [],
  );

  const updateDeck = useCallback(
    async (
      id: string,
      payload: DeckUpdateParams,
    ): Promise<DeckItem | undefined> => {
      setIsMutating(true);
      try {
        const deck = await deckService.updateDeck(id, payload);
        await upsertDecks([deckItemToUpsert(deck)]);
        return deck;
      } catch (e: any) {
        setError(e?.message || "Couldn't update deck");
        return undefined;
      } finally {
        setIsMutating(false);
      }
    },
    [],
  );

  const deleteDeck = useCallback(async (id: string): Promise<void> => {
    setIsMutating(true);
    try {
      await deckService.deleteDeck(id);
      await dbDeleteDeck(id);
    } catch (e: any) {
      setError(e?.message || "Couldn't delete deck");
    } finally {
      setIsMutating(false);
    }
  }, []);

  /**
   * Optimistic favourite toggle.
   *
   * The DB flips first so the star responds on the same frame as the tap — it's a
   * one-bit change the user is looking directly at, and a round trip's latency on
   * it reads as a broken button. The API call follows; a failure puts the flag
   * back.
   *
   * The DB decides the new value rather than the caller (`1 - is_favourite` in
   * SQL), which is what keeps a double-tap consistent: two calls in flight can't
   * both read the old value and write the same new one.
   */
  const toggleFavourite = useCallback(
    async (id: string): Promise<boolean | undefined> => {
      const next = await toggleDeckFavourite(id);
      try {
        const deck = await deckService.updateDeck(id, { isFavourite: next });
        // Prefer the server's value over the optimistic one, in case another
        // device changed it in between.
        await setDeckFavourite(id, deck.isFavourite ?? next);
        return deck.isFavourite ?? next;
      } catch (e: any) {
        await setDeckFavourite(id, !next);
        setError(e?.message || "Couldn't update favourite");
        return undefined;
      }
    },
    [],
  );

  useEffect(() => {
    // Kicking off a network request on mount is the "synchronise with an
    // external system" case the rule exempts; it fires only because fetchDecks
    // flips isRefreshing before it awaits. Deferring that flag would just mean a
    // frame where a refresh is running and nothing says so.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (immediate) fetchDecks();
  }, [immediate, fetchDecks]);

  const clearError = useCallback(() => setError(null), []);

  return {
    data,
    isLoading,
    isRefreshing,
    isMutating,
    error,
    refresh: fetchDecks,
    fetchDecks,
    createDeck,
    updateDeck,
    deleteDeck,
    toggleFavourite,
    clearError,
  };
}

/**
 * Thin shim so call sites that still filter an array they already hold keep
 * working. Prefer passing `filter`/`sort` to `useDecks`, which pushes both into
 * SQL.
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
      // ISO-8601 compares lexicographically in chronological order, so no Date
      // parsing is needed — and unlike the old `.getTime()` this doesn't throw on
      // the strings the API actually returns.
      return sorted.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
}
