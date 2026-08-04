import { apiClient } from "@/lib/api/client";
import { AxiosProgressEvent, AxiosRequestHeaders } from "axios";

/**
 * Attachments are uploaded on their own, before the brief.
 *
 * They used to ride along as multipart on `POST /scripts`, which meant the
 * upload only started when the user pressed Generate: there was nothing to show
 * progress for, no way to hold the wizard's Next button on it, and an oversized
 * file was rejected only after the whole form had been filled in. Each file now
 * uploads the moment it is picked and comes back with an id the brief carries.
 *
 *   POST   /api/v1/attachments        -> upload one file, returns {id, url}
 *   DELETE /api/v1/attachments/{id}   -> remove one before it is submitted
 */

// Mirrors the caps in app/services/storage_service.py. Checked here first so
// the user is told before a slow upload rather than after it — the server still
// enforces its own, this is not a trust boundary.
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 50 * 1024 * 1024;

// A 20MB document on cellular will not finish inside the client's default 15s.
const UPLOAD_TIMEOUT_MS = 120_000;

export type AttachmentKindApi = "image" | "document";

export interface UploadedAttachment {
  id: number;
  kind: AttachmentKindApi;
  filename: string;
  contentType: string;
  sizeBytes: number;
  /** Presigned, for showing the file in the form. Never sent to the model —
   *  the worker reads the object out of storage directly. */
  url: string | null;
  /** Documents only: whether any text was actually extracted. */
  hasText: boolean;
}

interface AttachmentApiResponse {
  id: number;
  kind: AttachmentKindApi;
  filename: string;
  content_type: string;
  size_bytes: number;
  url: string | null;
  has_text: boolean;
  created_at: string;
}

const toUploaded = (data: AttachmentApiResponse): UploadedAttachment => ({
  id: data.id,
  kind: data.kind,
  filename: data.filename,
  contentType: data.content_type,
  sizeBytes: data.size_bytes,
  url: data.url,
  hasText: data.has_text,
});

export function maxBytesForKind(kind: AttachmentKindApi): number {
  return kind === "image" ? MAX_IMAGE_BYTES : MAX_DOCUMENT_BYTES;
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

/** The error message the form shows when a file is too big to bother sending. */
export function checkSize(
  kind: AttachmentKindApi,
  sizeBytes: number | undefined,
  existingTotal: number,
): string | null {
  // Some pickers don't report a size. Let the server be the judge rather than
  // refusing a file we know nothing about.
  if (sizeBytes == null) return null;

  const limit = maxBytesForKind(kind);
  if (sizeBytes > limit) {
    return `This ${kind} is ${formatBytes(sizeBytes)} — the limit is ${formatBytes(limit)}.`;
  }
  if (existingTotal + sizeBytes > MAX_TOTAL_BYTES) {
    return `Attachments would come to more than ${formatBytes(MAX_TOTAL_BYTES)}. Remove one first.`;
  }
  return null;
}

export const attachmentService = {
  /**
   * Upload one file, reporting progress as a 0..1 fraction.
   *
   * One file per request: a batched upload can't report which file is where,
   * and one rejected file would fail the whole set.
   */
  upload: async (
    file: { uri: string; name: string; type: string },
    onProgress?: (fraction: number) => void,
  ): Promise<UploadedAttachment> => {
    const formData = new FormData();
    // RN's FormData wants { uri, name, type }, not a real File/Blob — `as any`
    // because RN's typings don't model this shape, though it is the standard
    // pattern for native multipart uploads.
    formData.append("file", file as any);

    const response = await apiClient.post<AttachmentApiResponse>(
      "/api/v1/attachments",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        } as AxiosRequestHeaders,
        timeout: UPLOAD_TIMEOUT_MS,
        // Axios would otherwise try to serialise the FormData and send `{}`.
        transformRequest: (data: unknown) => data,
        onUploadProgress: (event: AxiosProgressEvent) => {
          if (!onProgress) return;
          // `total` is absent on some RN/Android uploads. Without it there is no
          // fraction to report, so the bar stays indeterminate rather than
          // jumping to a made-up number.
          if (event.total) onProgress(event.loaded / event.total);
        },
      } as any,
    );

    return toUploaded(response.data);
  },

  /** Remove a file the user took back out of the form. Fails with 409 once the
   *  attachment belongs to a generated script — its text is what revisions are
   *  grounded in. */
  remove: async (id: number): Promise<void> => {
    try {
      await apiClient.delete(`/api/v1/attachments/${id}`);
    } catch (e: any) {
      // Best-effort: the file is gone from the user's form either way, and the
      // server sweeps anything that was never submitted.
      console.log("attachment delete error", e?.response?.data, e?.response?.status);
    }
  },
};
