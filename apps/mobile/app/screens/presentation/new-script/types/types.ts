import { Attachment } from "@/types/presentation";

export type PresentationFormState = {
  attachments: Attachment[];
  description: string;
  durationMinutes: number;
  audienceIndex: number;
  cardCount: number;
};

export const AUDIENCES = [
  "General",
  "Executives",
  "Students",
  "Technical / Engineers",
  "Sales & Marketing",
  "Investors",
];

export const DEFAULT_STATE: PresentationFormState = {
  attachments: [],
  durationMinutes: 10,
  audienceIndex: 0,
  cardCount: 8,
  description: "",
};
