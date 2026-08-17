import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import { PublicDeck, publicDeckService } from "@/services/public-deck.service";

export interface UseSavedDecksReturn {
  decks: PublicDeck[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * The user's bookmarked public decks.
 *
 * Refetched on focus rather than cached: the list changes from the *other*
 * screen (the deck detail's save button), and a deck can also leave it without
 * the user doing anything at all — the author unpublishing removes it. A stale
 * saved list is one that 404s when you tap it.
 */
export function useSavedDecks(): UseSavedDecksReturn {
  const [decks, setDecks] = useState<PublicDeck[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // `isRefreshing` belongs to the pull gesture and nothing else. The mount and
  // focus fetches below reload the same list, but they aren't something the user
  // asked for, and driving a RefreshControl from them made the spinner appear
  // on its own every time the screen came back.
  const load = useCallback(async (fromPull: boolean) => {
    if (fromPull) setIsRefreshing(true);
    try {
      setDecks(await publicDeckService.listSaved());
      setError(null);
    } catch (e: any) {
      setError(
        e?.response?.data?.detail || e?.message || "Couldn't load saved decks",
      );
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  }, []);

  const refresh = useCallback(() => load(true), [load]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(false);
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load(false);
    }, [load]),
  );

  return { decks, isLoading, isRefreshing, error, refresh };
}
