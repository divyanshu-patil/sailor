import { useCallback, useEffect, useState } from "react";
import {
  PublicDeckDetail,
  publicDeckService,
} from "@/services/public-deck.service";
import { DeckItem } from "@/types/presentation/deck";

export interface UsePublicDeckReturn {
  /** The deck in the app's own shape, so the detail screen renders someone
   *  else's deck through exactly the same components as your own. */
  data: DeckItem | undefined;
  script: string | null;
  creatorName: string | null;
  isSaved: boolean;
  isLoading: boolean;
  error: string | null;
  toggleSaved: () => Promise<void>;
}

/**
 * One public deck, fetched fresh every time.
 *
 * No SQLite mirror on purpose — see public-deck.service. The trade is that a
 * public deck always reflects the author's latest edit rather than a copy
 * frozen at the moment someone looked at it.
 *
 * Pass a null id to make this inert; the detail screen calls it unconditionally
 * (hooks rules) but only wants it for public decks.
 */
export function usePublicDeck(id: string | null): UsePublicDeckReturn {
  const [detail, setDetail] = useState<PublicDeckDetail | null>(null);
  const [isLoading, setIsLoading] = useState(!!id);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    publicDeckService
      .get(id)
      .then((result) => {
        if (!active) return;
        setDetail(result);
        setIsLoading(false);
      })
      .catch((e: any) => {
        if (!active) return;
        setError(
          e?.response?.data?.detail ?? "This deck isn't available any more.",
        );
        setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  /**
   * Optimistic, and rolled back on failure.
   *
   * A bookmark is cheap and reversible, so making the icon wait on a round trip
   * would be the wrong trade — but leaving it flipped after a failed request
   * would tell the user something false about their saved list.
   */
  const toggleSaved = useCallback(async () => {
    if (!detail) return;
    const next = !detail.isSaved;
    // The count moves with the icon. It's the reader's own save either way, so
    // ±1 is exactly what the server will report on the next fetch.
    const step = next ? 1 : -1;
    setDetail({
      ...detail,
      isSaved: next,
      saveCount: Math.max(0, detail.saveCount + step),
    });
    try {
      await publicDeckService.setSaved(detail.id, next);
    } catch {
      setDetail((current) =>
        current
          ? {
              ...current,
              isSaved: !next,
              saveCount: Math.max(0, current.saveCount - step),
            }
          : current,
      );
      setError(next ? "Couldn't save this deck" : "Couldn't remove this deck");
    }
  }, [detail]);

  const data: DeckItem | undefined = !detail
    ? undefined
    : {
        id: detail.id,
        title: detail.title,
        description: detail.description,
        color: detail.color,
        // The detail screen shows this as "last updated". For a public deck the
        // meaningful date is when it was published — the author's private edit
        // history isn't the reader's business.
        updatedAt: detail.publishedAt ?? new Date().toISOString(),
        slideCount: detail.slideCount,
        durationMins: detail.durationMins,
        isFavourite: false,
        isPublic: true,
        tags: detail.tags,
        category: detail.category,
        practiceCount: detail.practiceCount,
        saveCount: detail.saveCount,
      };

  return {
    data,
    script: detail?.script ?? null,
    creatorName: detail?.creator.name ?? null,
    isSaved: detail?.isSaved ?? false,
    isLoading,
    error,
    toggleSaved,
  };
}
