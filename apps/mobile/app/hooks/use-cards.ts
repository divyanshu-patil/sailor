import { useCallback, useEffect, useRef, useState } from "react";
import { cardService, CardEdit } from "@/services/card.service";
import { subscribeToTables, TABLES } from "@/db";
import {
  getCard as dbGetCard,
  listCards as dbListCards,
  patchCard,
  replaceDeckCards,
  StoredCard,
  upsertCards,
} from "@/db/cards.repo";
import { cardToUpsert } from "@/db/mappers";

export interface UseCardsOptions {
  deckId: string;
  onSuccess?: (data: StoredCard[]) => void;
  onError?: (error: Error) => void;
  /** Auto-refresh from the API on mount. */
  immediate?: boolean;
}

/** What `saveCard` reports back, so the caller can branch on a conflict without
 *  digging through an exception. */
export type SaveCardOutcome =
  | { status: "ok" }
  | { status: "conflict"; message: string }
  | { status: "error"; message: string };

export interface UseCardsReturn {
  data: StoredCard[] | undefined;
  isLoading: boolean;
  isRefreshing: boolean;
  isSaving: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  fetchCards: () => Promise<void>;
  saveCard: (cardId: string, edit: CardEdit) => Promise<SaveCardOutcome>;
  clearError: () => void;
}

/**
 * A deck's cards, read from SQLite and refreshed from the API — same
 * service -> hook -> db -> UI flow as `useDecks`.
 *
 * A refresh replaces the deck's card set wholesale rather than merging, because
 * card colours are ranked across the whole set: merging a fresh run into a stale
 * one leaves survivors coloured against a ranking that no longer exists.
 */
export function useCards(options: UseCardsOptions): UseCardsReturn {
  const { deckId, onSuccess, onError, immediate = true } = options;

  const [data, setData] = useState<StoredCard[] | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  });

  const readFromDb = useCallback(async () => {
    const rows = await dbListCards(deckId);
    setData(rows);
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
    const unsubscribe = subscribeToTables([TABLES.cards], read);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [readFromDb]);

  const fetchCards = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const cards = await cardService.getCards(deckId);
      await replaceDeckCards(deckId, cards.map(cardToUpsert));
      onSuccessRef.current?.(await dbListCards(deckId));
    } catch (e: any) {
      setError(
        e?.response?.data?.detail || e?.message || "Couldn't load these cards",
      );
      onErrorRef.current?.(e);
    } finally {
      setIsRefreshing(false);
    }
  }, [deckId]);

  /**
   * Save a manual card edit.
   *
   * Optimistic: the local row is patched first so the edit is on screen
   * immediately, then the API call follows. Three ways it ends —
   *
   *  - ok:       the server's card is written over the optimistic one, so any
   *              field it derived (an impact change re-ranks colours) lands too.
   *  - conflict: someone else edited it first. The whole card set is re-fetched
   *              so the user sees the version that won rather than their own
   *              rejected text, and the caller is told so it can say why.
   *  - error:    the optimistic patch is rolled back to the values held before.
   */
  const saveCard = useCallback(
    async (cardId: string, edit: CardEdit): Promise<SaveCardOutcome> => {
      // Read the card from the DB rather than from `data`: the DB is the source
      // of truth, and depending on `data` here would rebuild this callback on
      // every re-read, churning the identity for anything that memoises on it.
      const before = await dbGetCard(cardId);
      if (!before) {
        return { status: "error", message: "That card isn't loaded." };
      }

      setIsSaving(true);
      setError(null);

      await patchCard(cardId, {
        title: edit.title,
        description: edit.description,
        keywords: edit.keywords,
      });

      try {
        const result = await cardService.updateCard(
          deckId,
          cardId,
          before.version,
          edit,
        );

        if (result.status === "ok") {
          // An impact change re-ranks colours across the deck, so *other* cards
          // come back different and the whole set has to be re-read. Any other
          // edit affects only this card, and the response already has it.
          if (edit.impact === undefined) {
            await upsertCards([cardToUpsert(result.card)]);
          } else {
            await fetchCards();
          }
          return { status: "ok" };
        }

        if (result.status === "conflict") {
          await fetchCards();
          setError(result.message);
          return { status: "conflict", message: result.message };
        }

        await patchCard(cardId, {
          title: before.text,
          description: before.reveal,
          keywords: before.keywords,
        });
        setError(result.message);
        return { status: "error", message: result.message };
      } finally {
        setIsSaving(false);
      }
    },
    [deckId, fetchCards],
  );

  useEffect(() => {
    // See the matching note in use-decks: mount-fetch, flagged only because the
    // fetch sets its loading flag before awaiting.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (immediate && deckId) fetchCards();
  }, [immediate, deckId, fetchCards]);

  const clearError = useCallback(() => setError(null), []);

  return {
    data,
    isLoading,
    isRefreshing,
    isSaving,
    error,
    refresh: fetchCards,
    fetchCards,
    saveCard,
    clearError,
  };
}
