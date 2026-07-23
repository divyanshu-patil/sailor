import { apiClient } from "@/lib/api/client";
import {
  AudienceType,
  toBackendAudience,
} from "@/screens/presentation/new-script/types/types";

export type DeckGenerationStatus =
  | "pending"
  | "processing"
  | "script_ready"
  | "revising"
  | "generating_cards"
  | "completed"
  | "failed"
  | "cancelled";

// Events the websocket can send that are NOT persisted deck statuses —
// they're transient signals for the UI (e.g. show a toast) that don't
// correspond to deck.generation_status.
export type DeckWsTransientEvent = "retrying" | "revise_failed";

export interface DeckWsEvent {
  status: DeckGenerationStatus | DeckWsTransientEvent;
  deck?: DeckResponse;
  error?: string;
  progress?: number;
  attempt?: number;
  [key: string]: unknown;
}

const PERSISTED_STATUSES: DeckGenerationStatus[] = [
  "pending",
  "processing",
  "script_ready",
  "revising",
  "generating_cards",
  "completed",
  "failed",
  "cancelled",
];

export function isDeckGenerationStatus(
  value: string,
): value is DeckGenerationStatus {
  return (PERSISTED_STATUSES as string[]).includes(value);
}

export const ACTIVE_STATUSES: DeckGenerationStatus[] = [
  "pending",
  "processing",
  "revising",
  "generating_cards",
];

export interface GenerateDeckPayload {
  description: string;
  durationMins: number;
  audience: AudienceType; // AudienceType value, e.g. "general"
  cardCount: number;
}

// Matches DeckResponse exactly — no `audience`, `description`, `is_public`,
// or `recording_url`; the backend doesn't return those fields.
export interface DeckResponse {
  id: number;
  user_id: number;
  title: string;
  script: string | null;
  color: string;
  duration_mins: number;
  card_count: number;
  is_favorite: boolean;
  generation_status: DeckGenerationStatus;
  generation_error: string | null;
  created_at: string;
  updated_at: string;
}

// Matches AllDeckInfoResponse's aliases — FastAPI serializes response
// models by_alias by default, so these camelCase keys are what actually
// comes back over the wire (unlike DeckResponse, which has no aliases).
export interface AllDeckInfoResponse {
  id: number;
  title: string;
  description: string;
  color: string;
  updatedAt: string;
  slideCount: number;
  durationMins: number;
  isFavourite: boolean;
}

export const deckGenerationService = {
  generate: async (payload: GenerateDeckPayload): Promise<DeckResponse> => {
    try {
      // DeckCreateRequest declares cardCount/durationMinutes as *aliases*
      // with no populate_by_name — the request body must use these exact
      // camelCase keys, not card_count/duration_mins.
      const response = await apiClient.post<DeckResponse>(
        "/api/v1/decks/script/generate",
        {
          description: payload.description,
          cardCount: payload.cardCount,
          durationMinutes: payload.durationMins,
          audience: toBackendAudience(payload.audience),
        },
      );
      console.log(response.data);
      return response.data;
    } catch (e: any) {
      console.log("deck generate error", e.response?.data, e.response?.status);
      throw e;
    }
  },

  getDeck: async (deckId: number | string): Promise<DeckResponse> => {
    try {
      const response = await apiClient.get<DeckResponse>(
        `/api/v1/decks/${deckId}`,
      );
      return response.data;
    } catch (e: any) {
      console.log("get deck error", e.response?.data, e.response?.status);
      throw e;
    }
  },

  listDecks: async (): Promise<AllDeckInfoResponse[]> => {
    try {
      const response =
        await apiClient.get<AllDeckInfoResponse[]>("/api/v1/decks/");
      return response.data;
    } catch (e: any) {
      console.log("list decks error", e.response?.data, e.response?.status);
      throw e;
    }
  },

  revise: async (
    deckId: number | string,
    instruction: string,
  ): Promise<DeckResponse> => {
    try {
      const response = await apiClient.post<DeckResponse>(
        `/api/v1/decks/${deckId}/revise`,
        { instruction },
      );
      return response.data;
    } catch (e: any) {
      console.log("revise deck error", e.response?.data, e.response?.status);
      throw e;
    }
  },

  edit: async (
    deckId: number | string,
    script: string,
  ): Promise<DeckResponse> => {
    try {
      const response = await apiClient.post<DeckResponse>(
        `/api/v1/decks/${deckId}/edit`,
        { script },
      );
      return response.data;
    } catch (e: any) {
      console.log("edit deck error", e.response?.data, e.response?.status);
      throw e;
    }
  },

  confirm: async (deckId: number | string): Promise<DeckResponse> => {
    try {
      const response = await apiClient.post<DeckResponse>(
        `/api/v1/decks/${deckId}/confirm`,
      );
      return response.data;
    } catch (e: any) {
      console.log("confirm deck error", e.response?.data, e.response?.status);
      throw e;
    }
  },

  cancel: async (deckId: number | string): Promise<DeckResponse> => {
    try {
      const response = await apiClient.post<DeckResponse>(
        `/api/v1/decks/${deckId}/cancel`,
      );
      return response.data;
    } catch (e: any) {
      console.log("cancel deck error", e.response?.data, e.response?.status);
      throw e;
    }
  },

  connectProgressSocket: (
    deckId: number | string,
    token: string,
  ): WebSocket => {
    const base = apiClient.defaults.baseURL ?? "";
    const wsProtocol = base.startsWith("https") ? "wss" : "ws";
    const host = base.replace(/^https?:\/\//, "").replace(/\/+$/, ""); // strip trailing slash(es)
    const url = `${wsProtocol}://${host}/api/v1/decks/${deckId}/ws?token=${encodeURIComponent(token)}`;
    return new WebSocket(url);
  },
};
