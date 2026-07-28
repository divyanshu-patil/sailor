export type AttachmentKind = "image" | "document" | "link";

export type Attachment = {
  id: string;
  kind: AttachmentKind;
  name: string;
  uri?: string;
};

/**
 * Mirrors the backend's AudienceType enum
 * (apps/backend/app/utils/enums/deck_enums.py). The API takes the `value`;
 * the picker in new-script shows the `label`.
 *
 * The backend also accepts "educational", which the app doesn't surface yet.
 */
export type AudienceType =
  | "general"
  | "executives"
  | "students"
  | "technical"
  | "business"
  | "educational"
  | "investors";

export const AUDIENCE_OPTIONS: { label: string; value: AudienceType }[] = [
  { label: "General", value: "general" },
  { label: "Executives", value: "executives" },
  { label: "Students", value: "students" },
  { label: "Technical / Engineers", value: "technical" },
  { label: "Sales & Marketing", value: "business" },
  { label: "Investors", value: "investors" },
];
