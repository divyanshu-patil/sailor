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

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return { decks, isLoading, isRefreshing, error, refresh };
}
