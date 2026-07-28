import { apiClient } from "@/lib/api/client";
import {
  Attachment,
  AUDIENCE_OPTIONS,
  AudienceType,
} from "@/types/presentation";

/**
 * Scripts are their own resource now.
 *
 * They used to be a property of a deck: `POST /decks` created a deck row *and*
 * queued the script job, so the deck existed before the script did — and every
 * generation the user discarded or walked away from left a permanent, card-less
 * deck behind. A script is now generated against a generation of its own, and a
 * deck is created at exactly one moment: when the user accepts the result.
 *
 *   POST   /api/v1/scripts                      -> start (or resume) a generation
 *   GET    /api/v1/scripts                      -> drafts: scripts with no deck yet
 *   GET    /api/v1/scripts/{id}                 -> the generation
 *   GET    /api/v1/scripts/{id}/status          -> poll target, doubles as heartbeat
 *   PATCH  /api/v1/scripts/{id}                 -> manual edit (appends a version)
 *   POST   /api/v1/scripts/{id}/revise          -> AI revision (appends a version)
 *   POST   /api/v1/scripts/{id}/retry           -> re-run the same brief
 *   POST   /api/v1/scripts/{id}/cancel          -> stop the job at the provider
 *   GET    /api/v1/scripts/{id}/versions        -> undo/redo history
 *   POST   /api/v1/scripts/{id}/versions/{v}/restore
 *   POST   /api/v1/scripts/{id}/deck            -> accept: create deck + queue cards
 *   DELETE /api/v1/scripts/{id}                 -> discard the draft
 *
 * The card job still belongs to the deck, so it stays on deck.service.
 */

// Mirrors GenerationStatus in app/utils/enums/deck_enums.py. "retrying" isn't in
// the enum — the Celery tasks write it straight to the Redis status payload
// between attempts, so it only ever shows up on the status endpoint.
export type ScriptJobStatus =
  | "pending"
  | "processing"
  | "retrying"
  | "completed"
  | "failed"
  // Only ever the result of the user stopping, leaving for home, or backgrounding
  // the app — never of something going wrong. The UI treats it as a resting state
  // with a "Try again", not an error.
  | "cancelled";

export type ScriptVersionKind = "generated" | "revised" | "edited";

export interface GenerateScriptPayload {
  attachments: Attachment[]; // collected by the form; the API ignores these for now
  description: string;
  durationMinutes: number;
  audienceIndex: number;
  cardCount: number;
}

export interface ScriptGeneration {
  id: string;
  description: string;
  durationMinutes: number;
  cardCount: number;
  audience: string;
  title: string;
  script: string;
  status: ScriptJobStatus;
  error: string | null;
  /** Set once this script was accepted and became a deck. Non-null means the
   *  draft is retired — there's nothing left to resume. */
  deckId: string | null;
  versionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScriptDraftSummary {
  id: string;
  description: string;
  durationMinutes: number;
  cardCount: number;
  audience: string;
  title: string;
  status: ScriptJobStatus;
  deckId: string | null;
  versionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScriptVersion {
  id: string;
  position: number;
  title: string;
  script: string;
  kind: ScriptVersionKind;
  instruction: string | null;
  createdAt: string;
}

export interface StartGenerationResult {
  generation: ScriptGeneration;
  /** True when the API handed back a generation that already existed for this
   *  exact brief instead of starting a second identical job. The preview screen
   *  keys "resume, don't restart" off this. */
  reused: boolean;
}

/** What the poller reads. `script` and `title` arrive inline on completion, so
 *  a finished poll needs no follow-up request. */
export interface ScriptStatusResult {
  status: ScriptJobStatus;
  error?: string;
  title?: string;
  script?: string;
  attempt?: number;
}

// ---- API shapes (snake_case, straight off the Pydantic schemas) ------------

interface GenerationApiResponse {
  id: number;
  description: string;
  duration_mins: number;
  card_count: number;
  audience: string;
  title: string | null;
  script: string | null;
  status: ScriptJobStatus;
  error: string | null;
  deck_id: number | null;
  version_count: number;
  created_at: string;
  updated_at: string;
}

/** The drafts list omits `script` — see ScriptGenerationSummary on the API for
 *  why: a full script per draft would make the list enormous. */
type SummaryApiResponse = Omit<GenerationApiResponse, "script">;

interface VersionApiResponse {
  id: number;
  position: number;
  title: string;
  script: string;
  kind: ScriptVersionKind;
  instruction: string | null;
  created_at: string;
}

interface StatusApiResponse {
  status: ScriptJobStatus;
  error?: string;
  title?: string | null;
  script?: string | null;
  attempt?: number;
}

interface DeckBuildApiResponse {
  status: ScriptJobStatus;
  deck_id: number | null;
  error?: string | null;
}

/** Progress of turning an accepted script into a deck. `deckId` arrives only at
 *  the end — the deck and its cards are created in one transaction, so seeing an
 *  id means the deck is complete. */
export interface DeckBuildStatus {
  status: ScriptJobStatus;
  deckId: string | null;
  error?: string;
}

const toDeckBuildStatus = (data: DeckBuildApiResponse): DeckBuildStatus => ({
  status: data.status,
  deckId: data.deck_id == null ? null : String(data.deck_id),
  error: data.error ?? undefined,
});

const toGeneration = (data: GenerationApiResponse): ScriptGeneration => ({
  id: String(data.id),
  description: data.description,
  durationMinutes: data.duration_mins,
  cardCount: data.card_count,
  audience: data.audience,
  title: data.title ?? "",
  script: data.script ?? "",
  status: data.status,
  error: data.error,
  deckId: data.deck_id == null ? null : String(data.deck_id),
  versionCount: data.version_count,
  createdAt: data.created_at,
  updatedAt: data.updated_at,
});

const toSummary = (data: SummaryApiResponse): ScriptDraftSummary => ({
  id: String(data.id),
  description: data.description,
  durationMinutes: data.duration_mins,
  cardCount: data.card_count,
  audience: data.audience,
  title: data.title ?? "",
  status: data.status,
  deckId: data.deck_id == null ? null : String(data.deck_id),
  versionCount: data.version_count,
  createdAt: data.created_at,
  updatedAt: data.updated_at,
});

const toVersion = (data: VersionApiResponse): ScriptVersion => ({
  id: String(data.id),
  position: data.position,
  title: data.title,
  script: data.script,
  kind: data.kind,
  instruction: data.instruction,
  createdAt: data.created_at,
});

const log = (label: string, e: any) => {
  console.log(label, e?.response?.data, e?.response?.status);
};

export const scriptService = {
  /**
   * Start generating — or resume the generation this brief already has.
   *
   * Resubmitting an unchanged brief is free: the API matches on a fingerprint of
   * the brief and returns the existing generation with `reused: true`. That's
   * what makes stepping back to the wizard and pressing Generate again a no-op
   * rather than a discard-and-regenerate.
   */
  generate: async (
    payload: GenerateScriptPayload,
  ): Promise<StartGenerationResult> => {
    try {
      const audience =
        AUDIENCE_OPTIONS[payload.audienceIndex]?.value ??
        ("general" satisfies AudienceType);

      // Field names are the aliases ScriptGenerateRequest declares; attachments
      // are left out because the backend hasn't enabled them yet.
      const response = await apiClient.post<{
        generation: GenerationApiResponse;
        reused: boolean;
      }>("/api/v1/scripts", {
        description: payload.description,
        durationMinutes: payload.durationMinutes,
        cardCount: payload.cardCount,
        audience,
      });

      return {
        generation: toGeneration(response.data.generation),
        reused: response.data.reused,
      };
    } catch (e: any) {
      log("script generate error", e);
      throw e;
    }
  },

  /** Poll until status is terminal. Also the heartbeat that tells the API a
   *  client is still watching — a generation nobody polls gets swept. */
  getJobStatus: async (id: string): Promise<ScriptStatusResult> => {
    try {
      const response = await apiClient.get<StatusApiResponse>(
        `/api/v1/scripts/${id}/status`,
      );
      const { status, error, title, script, attempt } = response.data;
      return {
        status,
        error,
        title: title ?? undefined,
        script: script ?? undefined,
        attempt,
      };
    } catch (e: any) {
      log("script status error", e);
      throw e;
    }
  },

  get: async (id: string): Promise<ScriptGeneration> => {
    try {
      const response = await apiClient.get<GenerationApiResponse>(
        `/api/v1/scripts/${id}`,
      );
      return toGeneration(response.data);
    } catch (e: any) {
      log("script get error", e);
      throw e;
    }
  },

  /** Drafts — scripts that never became decks, including runs abandoned
   *  mid-generation. */
  listDrafts: async (): Promise<ScriptDraftSummary[]> => {
    try {
      const response =
        await apiClient.get<SummaryApiResponse[]>("/api/v1/scripts");
      return response.data.map(toSummary);
    } catch (e: any) {
      log("script drafts error", e);
      throw e;
    }
  },

  /** AI revision. Async, like the initial generation: this returns as soon as
   *  the job is queued and the caller goes back to polling getJobStatus. */
  revise: async (id: string, instruction: string): Promise<ScriptGeneration> => {
    try {
      const response = await apiClient.post<GenerationApiResponse>(
        `/api/v1/scripts/${id}/revise`,
        { instruction },
      );
      return toGeneration(response.data);
    } catch (e: any) {
      log("script revise error", e);
      throw e;
    }
  },

  /** Manual edit — full replacement text from the edit screen. Synchronous, and
   *  appended to the version history so it undoes like a revision. */
  edit: async (id: string, script: string): Promise<ScriptGeneration> => {
    try {
      const response = await apiClient.patch<GenerationApiResponse>(
        `/api/v1/scripts/${id}`,
        { script },
      );
      return toGeneration(response.data);
    } catch (e: any) {
      log("script edit error", e);
      throw e;
    }
  },

  /**
   * Stop the job at the provider.
   *
   * Called on an explicit Stop, and when the user lands on home or backgrounds
   * the app — deliberately *not* on a plain back out of the preview screen,
   * which is the accidental gesture this whole flow was losing work to.
   * Resolves even if the job had already finished.
   */
  cancel: async (id: string): Promise<void> => {
    try {
      await apiClient.post(`/api/v1/scripts/${id}/cancel`);
    } catch (e: any) {
      log("script cancel error", e);
      throw e;
    }
  },

  /** "Try again" after a failed or cancelled run — re-queues the same brief on
   *  the same generation, so no dead draft is left behind. */
  retry: async (id: string): Promise<ScriptGeneration> => {
    try {
      const response = await apiClient.post<GenerationApiResponse>(
        `/api/v1/scripts/${id}/retry`,
      );
      return toGeneration(response.data);
    } catch (e: any) {
      log("script retry error", e);
      throw e;
    }
  },

  /** Oldest first. The undo/redo arrows step through this. */
  listVersions: async (id: string): Promise<ScriptVersion[]> => {
    try {
      const response = await apiClient.get<VersionApiResponse[]>(
        `/api/v1/scripts/${id}/versions`,
      );
      return response.data.map(toVersion);
    } catch (e: any) {
      log("script versions error", e);
      throw e;
    }
  },

  /** Make an earlier version current again. Nothing is deleted, so redo is just
   *  restoring a later version. */
  restoreVersion: async (
    id: string,
    versionId: string,
  ): Promise<ScriptGeneration> => {
    try {
      const response = await apiClient.post<GenerationApiResponse>(
        `/api/v1/scripts/${id}/versions/${versionId}/restore`,
      );
      return toGeneration(response.data);
    } catch (e: any) {
      log("script restore error", e);
      throw e;
    }
  },

  /**
   * Accept the script: queue the job that generates the cards and then creates
   * the deck.
   *
   * Resolves as soon as the job is queued — there is no deck yet, and that's the
   * point. The deck and its cards are written together at the end of the job, so
   * a deck can never be seen before its cards exist. Poll `getDeckBuildStatus`
   * for the id.
   *
   * Idempotent server-side: a double tap returns the running job, or the deck if
   * it already finished.
   */
  startDeckBuild: async (id: string): Promise<DeckBuildStatus> => {
    try {
      const response = await apiClient.post<DeckBuildApiResponse>(
        `/api/v1/scripts/${id}/deck`,
      );
      return toDeckBuildStatus(response.data);
    } catch (e: any) {
      log("script deck build error", e);
      throw e;
    }
  },

  /** `deckId` is null until the cards are written. A non-null one is a complete
   *  deck, never a placeholder. */
  getDeckBuildStatus: async (id: string): Promise<DeckBuildStatus> => {
    try {
      const response = await apiClient.get<DeckBuildApiResponse>(
        `/api/v1/scripts/${id}/deck/status`,
      );
      return toDeckBuildStatus(response.data);
    } catch (e: any) {
      log("script deck status error", e);
      throw e;
    }
  },

  /** Stop the card job. Nothing has been written, so this leaves the generation
   *  as a draft rather than a half-built deck. */
  cancelDeckBuild: async (id: string): Promise<void> => {
    try {
      await apiClient.post(`/api/v1/scripts/${id}/deck/cancel`);
    } catch (e: any) {
      log("script deck cancel error", e);
      throw e;
    }
  },

  /** Throw the draft away, killing any job still running for it. */
  discard: async (id: string): Promise<void> => {
    try {
      await apiClient.delete(`/api/v1/scripts/${id}`);
    } catch (e: any) {
      log("script discard error", e);
      throw e;
    }
  },
};
