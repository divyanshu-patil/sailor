import { apiClient } from "@/lib/api/client";
import { CardPayload } from "@/db/mappers";

export * from "@/types/presentation/card";

/**
 * Cards are deck-scoped on the backend; there is no top-level card resource.
 *
 *   GET   /api/v1/decks/{id}/cards            -> the deck's cards, by position
 *   GET   /api/v1/decks/{id}/cards/{cardId}   -> one card
 *   PATCH /api/v1/decks/{id}/cards/{cardId}   -> manual edit (optimistic locking)
 *   POST  /api/v1/decks/{id}/cards/generate   -> start the card job
 *   GET   /api/v1/decks/{id}/cards/status     -> card job status
 *   POST  /api/v1/decks/{id}/cards/cancel     -> stop the card job
 *
 * Cards are created by generation, never by hand, so there is deliberately no
 * create/reorder here — the backend has no route for either.
 */

/** What a manual edit may change. `impact` is included because it re-ranks the
 *  deck's colours server-side, which is the one edit with a visible knock-on. */
export interface CardEdit {
  title?: string;
  description?: string;
  keywords?: string[];
  impact?: number;
  delivery?: string;
}

/**
 * Outcome of an edit, as a discriminated union rather than a throw.
 *
 * A version conflict isn't an error the caller should treat like a network
 * failure — it means someone else won, and the UI's job is to show the newer card
 * and let the user re-apply. Returning it as a value forces that case to be
 * handled instead of disappearing into a catch block.
 */
export type CardEditResult =
  | { status: "ok"; card: CardPayload }
  | { status: "conflict"; card: CardPayload | null; message: string }
  | { status: "error"; message: string };

/** Mirrors GenerationStatus on the API. "retrying" is written straight into the
 *  Redis status payload between Celery attempts, so it only ever appears here. */
export type CardJobStatus =
  | "pending"
  | "processing"
  | "retrying"
  | "completed"
  | "failed"
  | "cancelled";

export interface CardJobStatusResult {
  status: CardJobStatus;
  error?: string;
  cards?: CardPayload[];
}

export const cardService = {
  getCards: async (deckId: string): Promise<CardPayload[]> => {
    try {
      const response = await apiClient.get<CardPayload[]>(
        `/api/v1/decks/${deckId}/cards`,
      );
      return response.data;
    } catch (e: any) {
      console.log("getCards error", e.response?.data, e.response?.status);
      throw e;
    }
  },

  getCard: async (deckId: string, id: string): Promise<CardPayload> => {
    try {
      const response = await apiClient.get<CardPayload>(
        `/api/v1/decks/${deckId}/cards/${id}`,
      );
      return response.data;
    } catch (e: any) {
      console.log("getCard error", e.response?.data, e.response?.status);
      throw e;
    }
  },

  /**
   * Manual card edit.
   *
   * `expectedVersion` is the version the card was read at. The server rejects the
   * write if the card has moved on since, which is what stops two devices editing
   * the same card from silently clobbering each other — the loser gets a
   * "conflict" back, carrying the current server card so the UI can show what it
   * lost to without a second request.
   */
  updateCard: async (
    deckId: string,
    id: string,
    expectedVersion: number,
    edit: CardEdit,
  ): Promise<CardEditResult> => {
    try {
      const response = await apiClient.patch<CardPayload>(
        `/api/v1/decks/${deckId}/cards/${id}`,
        { expected_version: expectedVersion, ...edit },
      );
      return { status: "ok", card: response.data };
    } catch (e: any) {
      const httpStatus = e?.response?.status;

      if (httpStatus === 409) {
        // Re-read so the caller can show the version that won. Best-effort: if
        // even this fails, the conflict is still reported, just without the card.
        let current: CardPayload | null = null;
        try {
          current = await cardService.getCard(deckId, id);
        } catch {
          current = null;
        }
        return {
          status: "conflict",
          card: current,
          message:
            e?.response?.data?.detail ??
            "This card changed somewhere else. Reload it and reapply your edit.",
        };
      }

      console.log("updateCard error", e.response?.data, httpStatus);
      return {
        status: "error",
        message:
          e?.response?.data?.detail ?? e?.message ?? "Couldn't save this card",
      };
    }
  },

  /**
   * Card job status. The deck id is the job id — one card job per deck.
   *
   * The generation itself is started by `scriptService.createDeck`, not from
   * here: cards can only be generated for a deck, and a deck only exists once a
   * script was accepted, so kicking the job off is part of accepting. This
   * endpoint exists separately for resuming a job already in flight — the
   * results screen mounts after the deck was created and attaches to it.
   */
  getJobStatus: async (deckId: string): Promise<CardJobStatusResult> => {
    try {
      const response = await apiClient.get<CardJobStatusResult>(
        `/api/v1/decks/${deckId}/cards/status`,
      );
      return response.data;
    } catch (e: any) {
      console.log("cards status error", e.response?.data, e.response?.status);
      throw e;
    }
  },

  /** Re-run card generation for a deck whose job failed or was cancelled. */
  regenerate: async (deckId: string): Promise<CardJobStatus> => {
    try {
      const response = await apiClient.post<{
        cards_generation_status: CardJobStatus;
      }>(`/api/v1/decks/${deckId}/cards/generate`);
      return response.data.cards_generation_status;
    } catch (e: any) {
      console.log("cards generate error", e.response?.data, e.response?.status);
      throw e;
    }
  },

  /** Stop card generation. The backend also clears any partially-written cards,
   *  since impact colours are ranked across a deck's whole card set. */
  cancelJob: async (deckId: string): Promise<void> => {
    try {
      await apiClient.post(`/api/v1/decks/${deckId}/cards/cancel`);
    } catch (e: any) {
      console.log("cards cancel error", e.response?.data, e.response?.status);
      throw e;
    }
  },
};
