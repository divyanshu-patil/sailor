import { useCallback, useEffect, useRef, useState } from "react";
import {
  deckService,
  DeckItem,
  DeckPublishParams,
  DeckUpdateParams,
} from "@/services/deck.service";
import { apiErrorMessage } from "@/lib/api/client";
import { subscribeToTables, TABLES } from "@/db";
import {
  deleteDeck as dbDeleteDeck,
  getDeck as dbGetDeck,
  getDeckScript,
  setDeckFavourite,
  toggleDeckFavourite,
  upsertDeck,
} from "@/db/decks.repo";
import { deckItemToUpsert } from "@/db/mappers";

export interface UseDeckOptions {
  /** The deck ID to fetch. */
  deckId: string;
  /** Shown until the DB read lands — e.g. the row the previous screen already
   *  had, so navigating in doesn't flash an empty card. */
  initialData?: DeckItem;
  onSuccess?: (data: DeckItem) => void;
  onError?: (error: Error) => void;
  /** Auto-refresh from the API on mount. */
  immediate?: boolean;
}

export interface UseDeckReturn {
  data: DeckItem | undefined;
  /** The deck's script. Only the detail endpoint returns it, so it arrives with
   *  the first refresh (or straight from disk if it's been fetched before). */
  script: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  isMutating: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  fetchDeck: () => Promise<void>;
  updateDeck: (payload: DeckUpdateParams) => Promise<DeckItem | undefined>;
  /** Both resolve to the updated deck, or undefined if the call failed — the
   *  caller reads that to decide whether to close its sheet. */
  publish: (payload: DeckPublishParams) => Promise<DeckItem | undefined>;
  unpublish: () => Promise<DeckItem | undefined>;
  deleteDeck: () => Promise<boolean>;
  toggleFavourite: () => Promise<boolean | undefined>;
  clearError: () => void;
}

/**
 * A single deck, read from SQLite and refreshed from the API.
 *
 * Same service -> hook -> db -> UI flow as `useDecks`; see that file for why.
 * The one addition here is `script`, which lives on the deck row but isn't part
 * of DeckItem — only the detail endpoint returns it, so it's tracked separately
 * rather than making every list row carry a null field.
 */
export function useDeck(options: UseDeckOptions): UseDeckReturn {
  const { deckId, initialData, onSuccess, onError, immediate = true } = options;

  const [data, setData] = useState<DeckItem | undefined>(initialData);
  const [script, setScript] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  });

  const readFromDb = useCallback(async () => {
    const [deck, storedScript] = await Promise.all([
      dbGetDeck(deckId),
      getDeckScript(deckId),
    ]);
    // A miss means the deck hasn't been fetched yet — keep initialData on screen
    // rather than blanking it while the first refresh is in flight.
    if (deck) setData(deck);
    setScript(storedScript);
    setIsLoading(false);
  }, [deckId]);

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

  const fetchDeck = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const detail = await deckService.getDeckDetail(deckId);
      await upsertDeck({
        ...deckItemToUpsert(detail.deck),
        script: detail.script,
        generationStatus: detail.generationStatus,
        createdAt: detail.createdAt,
      });
      onSuccessRef.current?.(detail.deck);
    } catch (e: any) {
      setError(
        e?.response?.data?.detail || e?.message || "Couldn't load this deck",
      );
      onErrorRef.current?.(e);
    } finally {
      setIsRefreshing(false);
    }
  }, [deckId]);

  const updateDeck = useCallback(
    async (payload: DeckUpdateParams): Promise<DeckItem | undefined> => {
      setIsMutating(true);
      try {
        const deck = await deckService.updateDeck(deckId, payload);
        await upsertDeck(deckItemToUpsert(deck));
        return deck;
      } catch (e: any) {
        setError(e?.response?.data?.detail || e?.message || "Couldn't save");
        return undefined;
      } finally {
        setIsMutating(false);
      }
    },
    [deckId],
  );

  /**
   * Publishing and unpublishing are not optimistic, unlike the favourite toggle.
   *
   * Publishing can be rejected by the server (a deck still generating, a
   * description that didn't validate), and showing a deck as "live in discover"
   * when it isn't is a lie about who can see the user's work — the one kind of
   * optimism worth paying a round trip to avoid.
   */
  const publish = useCallback(
    async (payload: DeckPublishParams): Promise<DeckItem | undefined> => {
      setIsMutating(true);
      setError(null);
      try {
        const deck = await deckService.publish(deckId, payload);
        await upsertDeck(deckItemToUpsert(deck));
        return deck;
      } catch (e: any) {
        setError(apiErrorMessage(e, "Couldn't publish this deck"));
        return undefined;
      } finally {
        setIsMutating(false);
      }
    },
    [deckId],
  );

  const unpublish = useCallback(async (): Promise<DeckItem | undefined> => {
    setIsMutating(true);
    setError(null);
    try {
      const deck = await deckService.unpublish(deckId);
      await upsertDeck(deckItemToUpsert(deck));
      return deck;
    } catch (e: any) {
      setError(apiErrorMessage(e, "Couldn't unpublish this deck"));
      return undefined;
    } finally {
      setIsMutating(false);
    }
  }, [deckId]);

  /**
   * Returns whether the delete went through, so the caller knows whether it's
   * safe to navigate away. Previously it swallowed the failure and returned
   * undefined either way, which meant a failed delete still popped the screen and
   * the deck reappeared in the grid.
   *
   * The local row is only removed after the server confirms — an optimistic
   * delete that failed would need the whole deck reconstructed to undo.
   */
  const deleteDeck = useCallback(async (): Promise<boolean> => {
    setIsMutating(true);
    try {
      await deckService.deleteDeck(deckId);
      await dbDeleteDeck(deckId);
      return true;
    } catch (e: any) {
      setError(
        e?.response?.data?.detail || e?.message || "Couldn't delete this deck",
      );
      return false;
    } finally {
      setIsMutating(false);
    }
  }, [deckId]);

  /** Optimistic, for the same reason as in `useDecks` — see the note there. */
  const toggleFavourite = useCallback(async (): Promise<boolean | undefined> => {
    const next = await toggleDeckFavourite(deckId);
    try {
      const deck = await deckService.updateDeck(deckId, { isFavourite: next });
      await setDeckFavourite(deckId, deck.isFavourite ?? next);
      return deck.isFavourite ?? next;
    } catch (e: any) {
      await setDeckFavourite(deckId, !next);
      setError(e?.message || "Couldn't update favourite");
      return undefined;
    }
  }, [deckId]);

  useEffect(() => {
    // See the matching note in use-decks: mount-fetch, flagged only because the
    // fetch sets its loading flag before awaiting.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (immediate && deckId) fetchDeck();
  }, [immediate, deckId, fetchDeck]);

  const clearError = useCallback(() => setError(null), []);

  return {
    data,
    script,
    isLoading,
    isRefreshing,
    isMutating,
    error,
    refresh: fetchDeck,
    fetchDeck,
    updateDeck,
    publish,
    unpublish,
    deleteDeck,
    toggleFavourite,
    clearError,
  };
}
