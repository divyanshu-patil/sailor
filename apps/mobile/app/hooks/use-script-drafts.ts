import { useCallback, useEffect, useRef, useState } from "react";
import { subscribeToTables, TABLES } from "@/db";
import {
  deleteDraft as dbDeleteDraft,
  listDrafts as dbListDrafts,
  pruneDraftsNotIn,
  upsertDrafts,
  type ScriptDraft,
} from "@/db/generations.repo";
import { scriptService } from "@/services/script.service";

export interface UseScriptDraftsOptions {
  onError?: (error: Error) => void;
  /** Auto-refresh from the API on mount. */
  immediate?: boolean;
}

export interface UseScriptDraftsReturn {
  data: ScriptDraft[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  discard: (id: string) => Promise<boolean>;
}

/**
 * Scripts that were generated but never turned into a deck.
 *
 * This is where the work now goes that used to become a card-less ghost deck.
 * A generation the user walked away from — mid-run or after reading the result —
 * stays here, resumable, instead of either vanishing or polluting the deck grid.
 *
 * Same service -> hook -> SQLite -> UI flow as `useDecks`: the API is the source
 * of truth for writes, SQLite for what renders, so a cold start paints from disk.
 */
export function useScriptDrafts(
  options: UseScriptDraftsOptions = {},
): UseScriptDraftsReturn {
  const { onError, immediate = true } = options;

  const [data, setData] = useState<ScriptDraft[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  });

  const readFromDb = useCallback(async () => {
    setData(await dbListDrafts());
    setIsLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    const read = () => {
      readFromDb().catch(() => {
        if (active) setIsLoading(false);
      });
    };
    read();
    const unsubscribe = subscribeToTables([TABLES.scriptDrafts], read);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [readFromDb]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const drafts = await scriptService.listDrafts();
      await upsertDrafts(
        drafts.map((draft) => ({
          id: draft.id,
          description: draft.description,
          durationMins: draft.durationMinutes,
          cardCount: draft.cardCount,
          audience: draft.audience,
          title: draft.title,
          status: draft.status,
          deckId: draft.deckId,
          versionCount: draft.versionCount,
          createdAt: draft.createdAt,
          updatedAt: draft.updatedAt,
        })),
      );
      // Anything on disk that wasn't in the payload was discarded elsewhere;
      // without this it would sit in the list forever, since nothing else
      // removes it. Note the summary carries no `script`, which is why the
      // upsert above COALESCEs rather than overwrites.
      await pruneDraftsNotIn(drafts.map((d) => d.id));
    } catch (e: any) {
      setError(
        e?.response?.data?.detail || e?.message || "Couldn't load your drafts",
      );
      onErrorRef.current?.(e);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  /** Throw a draft away. Kills any job still running for it server-side. The
   *  local row goes only once the server confirms — a failed discard that had
   *  already removed it locally would make the draft reappear on next refresh. */
  const discard = useCallback(async (id: string): Promise<boolean> => {
    try {
      await scriptService.discard(id);
      await dbDeleteDraft(id);
      return true;
    } catch (e: any) {
      setError(
        e?.response?.data?.detail || e?.message || "Couldn't discard this draft",
      );
      return false;
    }
  }, []);

  useEffect(() => {
    // See the matching note in use-decks: mount-fetch, flagged only because the
    // fetch sets its loading flag before awaiting.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (immediate) refresh();
  }, [immediate, refresh]);

  return { data, isLoading, isRefreshing, error, refresh, discard };
}
