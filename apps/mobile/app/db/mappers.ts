/**
 * API payload -> DB upsert translations.
 *
 * The only place snake_case from the server meets the camelCase the app uses, so
 * a rename on either side has exactly one file to change. Services stay pure HTTP
 * and don't know the DB exists; hooks call a service and then pass the result
 * through here on the way into a repo.
 */
import { DeckItem } from "@/types/presentation/deck";
import { DeckUpsert } from "./decks.repo";
import { CardUpsert } from "./cards.repo";

/** `GET /api/v1/decks` — AllDeckInfoResponse. No script, so it must not clear one. */
export interface DeckSummaryPayload {
  id: number | string;
  title: string | null;
  description: string;
  color: string;
  updatedAt: string;
  slideCount: number;
  durationMins: number;
  isFavourite: boolean;
}

/** `GET /api/v1/decks/{id}` — DeckResponse, straight off the SQLAlchemy model. */
export interface DeckDetailPayload {
  id: number | string;
  title: string | null;
  description: string | null;
  script: string | null;
  color: string;
  duration_mins: number;
  card_count: number;
  is_favorite: boolean;
  generation_status?: string | null;
  generation_error?: string | null;
  created_at: string;
  updated_at: string;
}

/** `GET /api/v1/decks/{id}/cards` — CardResponse. */
export interface CardPayload {
  id: number | string;
  deck_id: number | string;
  position: number;
  title: string;
  description: string;
  keywords: string[];
  color: string;
  impact: number;
  delivery: string;
  version: number;
  created_at?: string;
  updated_at?: string;
}

export function deckSummaryToUpsert(payload: DeckSummaryPayload): DeckUpsert {
  return {
    id: String(payload.id),
    title: payload.title ?? "",
    description: payload.description,
    color: payload.color,
    durationMins: payload.durationMins,
    slideCount: payload.slideCount,
    isFavourite: payload.isFavourite,
    updatedAt: payload.updatedAt,
    // script deliberately absent — see upsertDeck's COALESCE note.
  };
}

export function deckDetailToUpsert(payload: DeckDetailPayload): DeckUpsert {
  return {
    id: String(payload.id),
    title: payload.title ?? "",
    description: payload.description ?? "",
    script: payload.script,
    color: payload.color,
    durationMins: payload.duration_mins,
    slideCount: payload.card_count,
    isFavourite: payload.is_favorite,
    generationStatus: payload.generation_status ?? null,
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
  };
}

export function cardToUpsert(payload: CardPayload): CardUpsert {
  return {
    id: String(payload.id),
    deckId: String(payload.deck_id),
    position: payload.position,
    title: payload.title,
    description: payload.description,
    keywords: payload.keywords ?? [],
    color: payload.color,
    impact: payload.impact,
    delivery: payload.delivery,
    version: payload.version,
    createdAt: payload.created_at ?? null,
    updatedAt: payload.updated_at ?? null,
  };
}

/**
 * A DeckItem the app already holds, on its way back into the DB.
 *
 * Used where the app has a domain object rather than a payload — the results
 * screen handing its finished deck over, for instance.
 */
export function deckItemToUpsert(deck: DeckItem): DeckUpsert {
  return {
    id: deck.id,
    title: deck.title,
    description: deck.description,
    color: deck.color,
    durationMins: deck.durationMins,
    slideCount: deck.slideCount,
    isFavourite: deck.isFavourite ?? null,
    updatedAt: deck.updatedAt,
  };
}
