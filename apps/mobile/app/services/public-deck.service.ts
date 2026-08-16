import { apiClient } from "@/lib/api/client";

/**
 * The discover feed.
 *
 * Deliberately *not* mirrored into SQLite, unlike every other list in the app.
 * The local `decks` table is "my decks" — the grid, search and the practice
 * screen all read it — so writing other people's decks into it would put them
 * in the user's own library, which is exactly what the spec rules out. The feed
 * is a remote list that lives in the screen's state and is thrown away when the
 * screen goes.
 *
 *   GET    /api/v1/decks/public                   -> the feed (keyset paginated)
 *   GET    /api/v1/decks/public/{id}              -> one deck + its script + isSaved
 *   POST   /api/v1/decks/public/{id}/practice     -> bump the practice counter
 *   POST   /api/v1/decks/public/{id}/save         -> bookmark it
 *   DELETE /api/v1/decks/public/{id}/save         -> un-bookmark it
 *   GET    /api/v1/decks/saved                    -> the user's bookmarks
 *
 * Saving is a bookmark, not a copy: the deck stays the author's, keeps their
 * edits, and leaves the saved list if they unpublish it.
 */

export type PublicDeckSort = "recent" | "popular" | "duration";

export interface PublicDeckCreator {
  id: number;
  name: string;
}

export interface PublicDeck {
  id: string;
  title: string;
  description: string;
  color: string;
  audience: string;
  durationMins: number;
  slideCount: number;
  tags: string[];
  category: string | null;
  practiceCount: number;
  publishedAt: string | null;
  creator: PublicDeckCreator;
}

export interface PublicDeckDetail extends PublicDeck {
  script: string;
  /** Whether the signed-in reader has bookmarked it. Always false signed out. */
  isSaved: boolean;
}

export interface PublicDeckPage {
  items: PublicDeck[];
  /** Opaque — round-trip it verbatim, never parse it. Null means last page. */
  nextCursor: string | null;
  hasMore: boolean;
}

export interface PublicDeckQuery {
  cursor?: string | null;
  limit?: number;
  q?: string;
  category?: string | null;
  tag?: string | null;
  sort?: PublicDeckSort;
}

/** The API serialises this one by field name (`response_model_by_alias=False`),
 *  so it already arrives camelCase — except `id`, which is a number here and a
 *  string everywhere in the app. */
interface PublicDeckApiResponse {
  id: number;
  title: string | null;
  description: string | null;
  color: string;
  audience: string;
  durationMins: number;
  slideCount: number;
  tags: string[] | null;
  category: string | null;
  practiceCount: number;
  publishedAt: string | null;
  creator: PublicDeckCreator;
  script?: string | null;
  isSaved?: boolean;
}

const toPublicDeck = (deck: PublicDeckApiResponse): PublicDeck => ({
  id: String(deck.id),
  title: deck.title ?? "Untitled",
  description: deck.description ?? "",
  color: deck.color,
  audience: deck.audience,
  durationMins: deck.durationMins,
  slideCount: deck.slideCount,
  tags: deck.tags ?? [],
  category: deck.category,
  practiceCount: deck.practiceCount ?? 0,
  publishedAt: deck.publishedAt,
  creator: deck.creator,
});

const log = (label: string, e: any) => {
  console.log(label, e?.response?.data, e?.response?.status);
};

export const publicDeckService = {
  list: async (query: PublicDeckQuery = {}): Promise<PublicDeckPage> => {
    try {
      const response = await apiClient.get<{
        items: PublicDeckApiResponse[];
        nextCursor: string | null;
        hasMore: boolean;
      }>("/api/v1/decks/public", {
        // Undefined params are dropped by axios, which is what keeps the URL
        // (and therefore any HTTP cache key) stable for the default feed.
        params: {
          cursor: query.cursor || undefined,
          limit: query.limit,
          q: query.q?.trim() || undefined,
          category: query.category || undefined,
          tag: query.tag || undefined,
          sort: query.sort,
        },
      });
      return {
        items: response.data.items.map(toPublicDeck),
        nextCursor: response.data.nextCursor,
        hasMore: response.data.hasMore,
      };
    } catch (e: any) {
      log("public decks error", e);
      throw e;
    }
  },

  get: async (id: string): Promise<PublicDeckDetail> => {
    try {
      const response = await apiClient.get<PublicDeckApiResponse>(
        `/api/v1/decks/public/${id}`,
      );
      return {
        ...toPublicDeck(response.data),
        script: response.data.script ?? "",
        isSaved: response.data.isSaved ?? false,
      };
    } catch (e: any) {
      log("public deck error", e);
      throw e;
    }
  },

  /** The user's bookmarks, newest save first. Unpublished decks are already
   *  filtered out server-side. */
  listSaved: async (): Promise<PublicDeck[]> => {
    try {
      const response = await apiClient.get<PublicDeckApiResponse[]>(
        "/api/v1/decks/saved",
      );
      return response.data.map(toPublicDeck);
    } catch (e: any) {
      log("saved decks error", e);
      throw e;
    }
  },

  /** Idempotent both ways — the server treats a repeat as the state you asked
   *  for, so a double tap can't 409. */
  setSaved: async (id: string, saved: boolean): Promise<void> => {
    try {
      if (saved) await apiClient.post(`/api/v1/decks/public/${id}/save`);
      else await apiClient.delete(`/api/v1/decks/public/${id}/save`);
    } catch (e: any) {
      log("save deck error", e);
      throw e;
    }
  },

  /**
   * Count a practice run.
   *
   * Swallows its own failure on purpose: the user is on their way into a
   * practice session, and a counter that didn't increment is not a reason to
   * interrupt them with an error.
   */
  recordPractice: async (id: string): Promise<void> => {
    try {
      await apiClient.post(`/api/v1/decks/public/${id}/practice`);
    } catch (e: any) {
      log("practice count error", e);
    }
  },
};
