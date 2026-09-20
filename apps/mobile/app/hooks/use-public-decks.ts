import { useCallback, useEffect, useRef, useState } from "react";
import {
  PublicDeck,
  PublicDeckSort,
  publicDeckService,
} from "@/services/public-deck.service";

export interface UsePublicDecksOptions {
  q?: string;
  category?: string | null;
  tag?: string | null;
  sort?: PublicDeckSort;
}

export interface UsePublicDecksReturn {
  decks: PublicDeck[];
  /** First page only — a paint-nothing-yet state. Paging and re-querying keep
   *  the current list on screen and use the two flags below instead. */
  isLoading: boolean;
  isRefreshing: boolean;
  /** A re-query (search, category, sort) with results already on screen. The
   *  RefreshControl deliberately doesn't fire for these — see `load`. */
  isQuerying: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  /** `false` re-fetches without spinning the RefreshControl — the shimmer
   *  under the chips shows instead, as it does for any other re-query. */
  refresh: (fromPull?: boolean) => Promise<void>;
  loadMore: () => void;
}

/**
 * The discover feed.
 *
 * Unlike `useDecks`, this reads straight from the API with no SQLite mirror —
 * see public-deck.service for why other people's decks must not land in the
 * local `decks` table.
 *
 * Query changes (search text, category, tag, sort) restart pagination from the
 * top, which is the only correct thing to do with a keyset cursor: a cursor
 * describes a position in one specific ordering of one specific filter, so
 * carrying it across a query change would page through the wrong list.
 */
export function usePublicDecks(
  options: UsePublicDecksOptions = {},
): UsePublicDecksReturn {
  const { q = "", category = null, tag = null, sort = "recent" } = options;

  const [decks, setDecks] = useState<PublicDeck[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isQuerying, setIsQuerying] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cursor = useRef<string | null>(null);
  const hasMore = useRef(true);
  const [hasMoreState, setHasMoreState] = useState(true);

  /**
   * Guards against the two ways a paginated list double-loads:
   *
   *  - `busy` — FlashList fires onEndReached more than once for a single scroll
   *    to the bottom, and every one of those would append the same page. Only
   *    "more" waits on it; a query change must never be dropped just because a
   *    page was in flight when the user typed.
   *  - `queryId` — a response from the *previous* filter can land after the new
   *    one has already started. Stamping each run, dropping stale results, and
   *    letting only the current run clear `busy` is what stops a search for
   *    "pitch" from being overwritten by the empty query it replaced.
   */
  const busy = useRef(false);
  const queryId = useRef(0);

  const load = useCallback(
    async (mode: "reset" | "more", fromPull = false) => {
      if (mode === "more" && (busy.current || !hasMore.current)) return;

      busy.current = true;
      const runId = mode === "reset" ? ++queryId.current : queryId.current;

      // `isRefreshing` drives the RefreshControl, so only an actual pull sets
      // it. A reset also happens on mount and on every query change (typing,
      // category, sort), and spinning the control for those made it look like
      // the list refreshed itself every keystroke.
      if (mode === "reset") {
        if (fromPull) setIsRefreshing(true);
        else setIsQuerying(true);
      } else setIsLoadingMore(true);

      try {
        const page = await publicDeckService.list({
          cursor: mode === "more" ? cursor.current : null,
          q,
          category,
          tag,
          sort,
        });

        if (runId !== queryId.current) return;

        cursor.current = page.nextCursor;
        hasMore.current = page.hasMore;
        setHasMoreState(page.hasMore);
        setDecks((prev) =>
          mode === "reset" ? page.items : [...prev, ...page.items],
        );
        setError(null);
      } catch (e: any) {
        if (runId !== queryId.current) return;
        setError(
          e?.response?.data?.detail ||
            e?.message ||
            "Couldn't load public decks",
        );
      } finally {
        // A stale run clears nothing: the current run owns both the flags and
        // `busy`, so a late response can't unblock pagination for a query that
        // has already moved on.
        if (runId === queryId.current) {
          setIsLoading(false);
          setIsRefreshing(false);
          setIsQuerying(false);
          setIsLoadingMore(false);
          busy.current = false;
        }
      }
    },
    [q, category, tag, sort],
  );

  // Any query change is a fresh list: reset the cursor before the request goes
  // out, not after it comes back, or a `loadMore` fired in between would page
  // the old query into the new results.
  useEffect(() => {
    cursor.current = null;
    hasMore.current = true;
    // Same shape as the mount-fetch in use-decks/use-cards: flagged only
    // because `load` sets its loading flag before the first await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load("reset");
  }, [load]);

  const loadMore = useCallback(() => {
    void load("more");
  }, [load]);

  const refresh = useCallback(
    async (fromPull = true) => {
      cursor.current = null;
      hasMore.current = true;
      await load("reset", fromPull);
    },
    [load],
  );

  return {
    decks,
    isLoading,
    isRefreshing,
    isQuerying,
    isLoadingMore,
    hasMore: hasMoreState,
    error,
    refresh,
    loadMore,
  };
}
