export type AttachmentKind = "image" | "document" | "link";

/** Where a file is in its upload. `ready` is the only state that carries a
 *  `remoteId`, and the wizard's Next button waits for every file to reach it. */
export type AttachmentStatus = "uploading" | "ready" | "failed";

export type Attachment = {
  /** Local id, assigned at pick time. Not the server's — see `remoteId`. */
  id: string;
  kind: AttachmentKind;
  name: string;
  uri?: string;
  /** MIME type, as the picker reported it. */
  mimeType?: string;
  sizeBytes?: number;
  status?: AttachmentStatus;
  /** 0..1 while uploading. Undefined when the platform gave no total to
   *  measure against, which is what the UI shows an indeterminate state for. */
  progress?: number;
  /** The id the API assigned. Present only once `status` is `ready`; this is
   *  what the brief sends in `attachmentIds`. */
  remoteId?: number;
  /** Presigned URL for displaying the file. Never sent to the model. */
  url?: string;
  error?: string;
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
