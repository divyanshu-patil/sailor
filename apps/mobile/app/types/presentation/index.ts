export type AttachmentKind = "image" | "document" | "link";

export type Attachment = {
  id: string;
  kind: AttachmentKind;
  name: string;
  uri?: string;
};
