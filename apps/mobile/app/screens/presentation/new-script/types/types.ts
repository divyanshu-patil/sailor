export type AttachmentKind = "image" | "document" | "link";

export type Attachment = {
  id: string;
  kind: AttachmentKind;
  name: string;
  uri?: string;
};

export type PresentationFormState = {
  attachments: Attachment[];
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
};
