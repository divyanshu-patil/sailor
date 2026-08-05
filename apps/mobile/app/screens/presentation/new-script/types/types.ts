import { Attachment, AUDIENCE_OPTIONS } from "@/types/presentation";

export type PresentationFormState = {
  attachments: Attachment[];
  description: string;
  durationMinutes: number;
  audienceIndex: number;
  cardCount: number;
  isPublic: boolean;
};

// Labels only — `audienceIndex` indexes into AUDIENCE_OPTIONS, which is what
// script.service maps to the audience value the API expects.
export const AUDIENCES = AUDIENCE_OPTIONS.map((option) => option.label);

export const DEFAULT_STATE: PresentationFormState = {
  attachments: [],
  durationMinutes: 10,
  audienceIndex: 0,
  cardCount: 8,
  description: "",
  isPublic: false,
};
