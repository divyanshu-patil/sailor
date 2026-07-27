import { apiClient } from "@/lib/api/client";
import {
  Attachment,
  AUDIENCE_OPTIONS,
  AudienceType,
} from "@/types/presentation";

/**
 * Script generation is deck-scoped on the backend: there is no separate job
 * resource. `POST /decks` creates the deck row and queues the script job, and
 * the deck's own id is the handle everything else polls against:
 *
 *   POST  /api/v1/decks                      -> create deck + start script job
 *   GET   /api/v1/decks/{id}/status          -> script job status (+ deck when done)
 *   GET   /api/v1/decks/{id}                 -> the deck itself
 *   PATCH /api/v1/decks/{id}                 -> manual script edit / rename / favourite
 *   POST  /api/v1/decks/{id}/revise          -> AI revision, re-runs the script job
 *   POST  /api/v1/decks/{id}/cards/generate  -> start the card job
 *   GET   /api/v1/decks/{id}/cards/status    -> card job status (+ cards when done)
 *
 * `job_id` below is therefore always the deck id as a string.
 */

// Mirrors GenerationStatus in app/utils/enums/deck_enums.py. "retrying" isn't
// in the enum — the Celery tasks write it straight to the Redis status payload
// between attempts, so it only ever shows up on the status endpoints.
export type ScriptJobStatus =
  | "pending"
  | "processing"
  | "retrying"
  | "completed"
  | "failed";

export interface GenerateScriptPayload {
  attachments: Attachment[]; // collected by the form; the API ignores these for now
  description: string;
  durationMinutes: number;
  audienceIndex: number;
  cardCount: number;
}

export interface GenerateScriptResponse {
  job_id: string;
  status: ScriptJobStatus;
  type: "script" | "deck";
}

export interface ScriptJobStatusResponse<TResult = unknown> {
  job_id: string;
  status: ScriptJobStatus;
  type: "script" | "deck";
  error?: string;
  /** Present on "completed": the status endpoints return the payload inline,
   *  so the poller doesn't need a follow-up request. */
  result?: TResult;
}

export interface ScriptResult {
  id: string;
  job_id: string;
  title: string; // AI-generated title
  script: string; // full generated script content
  created_at: string;
}

export interface DeckResult {
  id: string;
  job_id: string;
  title: string;
  description: string;
  color: string;
  slideCount: number;
  durationMins: number;
  isFavourite: boolean;
  updatedAt: string; // ISO string from API
  created_at: string;
}

/** The API's DeckResponse (snake_case, straight off the SQLAlchemy model). */
interface DeckApiResponse {
  id: number;
  user_id: number;
  title: string | null;
  description: string | null;
  script: string | null;
  color: string;
  duration_mins: number;
  card_count: number;
  is_favorite: boolean;
  generation_status: ScriptJobStatus;
  generation_error: string | null;
  created_at: string;
  updated_at: string;
}

/** Shape of both status endpoints — see read_deck_status / read_card_status. */
interface JobStatusApiResponse {
  status: ScriptJobStatus;
  error?: string;
  deck?: DeckApiResponse;
  attempt?: number;
}

const toScriptResult = (deck: DeckApiResponse): ScriptResult => ({
  id: String(deck.id),
  job_id: String(deck.id),
  title: deck.title ?? "",
  script: deck.script ?? "",
  created_at: deck.created_at,
});

const toDeckResult = (deck: DeckApiResponse): DeckResult => ({
  id: String(deck.id),
  job_id: String(deck.id),
  title: deck.title ?? "",
  description: deck.description ?? "",
  color: deck.color,
  slideCount: deck.card_count,
  durationMins: deck.duration_mins,
  isFavourite: deck.is_favorite,
  updatedAt: deck.updated_at,
  created_at: deck.created_at,
});

export const scriptService = {
  // 1. Create the deck — this is what kicks off script generation. The deck id
  //    it returns is the id every call below polls against.
  generate: async (
    payload: GenerateScriptPayload,
  ): Promise<GenerateScriptResponse> => {
    try {
      const audience =
        AUDIENCE_OPTIONS[payload.audienceIndex]?.value ??
        ("general" satisfies AudienceType);

      // Field names are the aliases DeckCreateRequest declares; attachments are
      // left out because the backend hasn't enabled them yet.
      const response = await apiClient.post<DeckApiResponse>("/api/v1/decks", {
        description: payload.description,
        durationMinutes: payload.durationMinutes,
        cardCount: payload.cardCount,
        audience,
      });

      return {
        job_id: String(response.data.id),
        status: response.data.generation_status,
        type: "script",
      };
    } catch (e: any) {
      console.log(
        "script generate error",
        e.response?.data,
        e.response?.status,
      );
      throw e;
    }
  },

  // 2. Poll until status is "completed" | "failed". A completed response
  //    already carries the deck, so `result` is filled in here.
  getJobStatus: async (
    jobId: string,
  ): Promise<ScriptJobStatusResponse<ScriptResult>> => {
    try {
      const response = await apiClient.get<JobStatusApiResponse>(
        `/api/v1/decks/${jobId}/status`,
      );
      const { status, error, deck } = response.data;

      return {
        job_id: jobId,
        status,
        type: "script",
        error,
        result: deck ? toScriptResult(deck) : undefined,
      };
    } catch (e: any) {
      console.log("script status error", e.response?.data, e.response?.status);
      throw e;
    }
  },

  // 3. Fallback for the status payload above (cache miss mid-flight, or an
  //    attach() to a job that already finished long ago).
  getResult: async (jobId: string): Promise<ScriptResult> => {
    try {
      const response = await apiClient.get<DeckApiResponse>(
        `/api/v1/decks/${jobId}`,
      );
      return toScriptResult(response.data);
    } catch (e: any) {
      console.log("script result error", e.response?.data, e.response?.status);
      throw e;
    }
  },

  // 4. AI revision — async, like the initial generation: this returns as soon
  //    as the job is queued and the caller goes back to polling getJobStatus.
  revise: async (
    jobId: string,
    instruction: string,
  ): Promise<GenerateScriptResponse> => {
    try {
      const response = await apiClient.post<DeckApiResponse>(
        `/api/v1/decks/${jobId}/revise`,
        { instruction },
      );
      return {
        job_id: String(response.data.id),
        status: response.data.generation_status,
        type: "script",
      };
    } catch (e: any) {
      console.log("script revise error", e.response?.data, e.response?.status);
      throw e;
    }
  },

  // 5. Manual edit — full replacement text from the edit screen. Synchronous,
  //    no AI involved.
  edit: async (jobId: string, script: string): Promise<ScriptResult> => {
    try {
      const response = await apiClient.patch<DeckApiResponse>(
        `/api/v1/decks/${jobId}`,
        { script },
      );
      return toScriptResult(response.data);
    } catch (e: any) {
      console.log("script edit error", e.response?.data, e.response?.status);
      throw e;
    }
  },

  // 6. "Create" on the preview screen: turn the accepted script into cards.
  //    Same deck id, second job.
  confirm: async (jobId: string): Promise<GenerateScriptResponse> => {
    try {
      const response = await apiClient.post<{
        deck_id: number;
        card_count: number;
        cards_generation_status: ScriptJobStatus;
        cards_generation_error: string | null;
      }>(`/api/v1/decks/${jobId}/cards/generate`);

      return {
        job_id: String(response.data.deck_id),
        status: response.data.cards_generation_status,
        type: "deck",
      };
    } catch (e: any) {
      console.log("script confirm error", e.response?.data, e.response?.status);
      throw e;
    }
  },

  // 7. Card job status. Completed responses carry the cards, but the results
  //    screen renders the deck, so the deck is fetched by getDeckResult.
  getCardsJobStatus: async (
    jobId: string,
  ): Promise<ScriptJobStatusResponse<DeckResult>> => {
    try {
      const response = await apiClient.get<JobStatusApiResponse>(
        `/api/v1/decks/${jobId}/cards/status`,
      );
      const { status, error } = response.data;

      return { job_id: jobId, status, type: "deck", error };
    } catch (e: any) {
      console.log("cards status error", e.response?.data, e.response?.status);
      throw e;
    }
  },

  getDeckResult: async (jobId: string): Promise<DeckResult> => {
    try {
      const response = await apiClient.get<DeckApiResponse>(
        `/api/v1/decks/${jobId}`,
      );
      return toDeckResult(response.data);
    } catch (e: any) {
      console.log("deck result error", e.response?.data, e.response?.status);
      throw e;
    }
  },
};
