import { Attachment } from "@/types/presentation";

export type PresentationFormState = {
  attachments: Attachment[];
  description: string;
  durationMinutes: number;
  audience: AudienceType;
  cardCount: number;
};

export const AUDIENCES: AudienceType[] = [
  "General",
  "Executives",
  "Students",
  "Technical / Engineers",
  "Sales & Marketing",
  "Investors",
];

export type AudienceType =
  | "General"
  | "Executives"
  | "Students"
  | "Technical / Engineers"
  | "Sales & Marketing"
  | "Investors";

export const DEFAULT_STATE: PresentationFormState = {
  attachments: [],
  durationMinutes: 10,
  audience: "General",
  cardCount: 8,
  description: "",
};

// --- Backend audience mapping -------------------------------------------
// DeckCreateRequest.audience (app/schemas/deck_schema.py) only accepts
// these raw enum values — the form UI shows human labels instead, so this
// maps one to the other right at the API boundary.
export type BackendAudienceType =
  | "general"
  | "executives"
  | "students"
  | "technical"
  | "business"
  | "educational"
  | "investors";

// Record over the full AudienceType union — TS errors if a label in
// AUDIENCES is ever added without a corresponding backend mapping here.
export const AUDIENCE_TO_BACKEND: Record<AudienceType, BackendAudienceType> = {
  General: "general",
  Executives: "executives",
  Students: "students",
  "Technical / Engineers": "technical",
  // No exact form equivalent for backend's "educational" — using closest
  // fit for now. Flag if "Sales & Marketing" should map elsewhere, or if
  // "Educational" should become its own entry in AUDIENCES.
  "Sales & Marketing": "business",
  Investors: "investors",
};

export function toBackendAudience(label: AudienceType): BackendAudienceType {
  return AUDIENCE_TO_BACKEND[label];
}
