import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { useNativeState } from "@expo/ui/swift-ui";
import { PresentationFormState, DEFAULT_STATE } from "./types/types";
import { Attachment } from "@/types/presentation";
import {
  attachmentService,
  checkSize,
  type AttachmentKindApi,
} from "@/services/attachment.service";

// ---- Context -----------------------------------------------------------

type PresentationFormContextValue = {
  form: PresentationFormState;
  // SwiftUI TextField requires an ObservableState (from useNativeState),
  // not a plain string — these live in context so they survive the step
  // unmounting/remounting as the user moves back and forth.
  descriptionState: ReturnType<typeof useNativeState<string>>;
  linkDraftState: ReturnType<typeof useNativeState<string>>;
  descriptionValue: string;
  /** True while any file is still uploading. The wizard's Next button is
   *  disabled on this — a brief can't reference a file that isn't stored yet. */
  isUploading: boolean;
  isPublic: boolean;
  setIsPublic: (value: boolean) => void;
  /** Server ids of every uploaded file, in the order they were added. */
  attachmentIds: number[];
  addAttachment: (attachment: Attachment) => void;
  removeAttachment: (id: string) => void;
  retryAttachment: (id: string) => void;
  setDurationMinutes: (value: number) => void;
  setAudienceIndex: (value: number) => void;
  setCardCount: (value: number) => void;
  handleSetDescriptionValue: (text: string) => void;
};

const PresentationFormContext =
  createContext<PresentationFormContextValue | null>(null);

/** Links are collected but never uploaded — the API has no link support yet. */
const isUploadable = (a: Attachment) => a.kind !== "link" && !!a.uri;

export function PresentationFormProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [form, setForm] = useState<PresentationFormState>(DEFAULT_STATE);
  const descriptionState = useNativeState("");
  const linkDraftState = useNativeState("");

  // Progress arrives many times a second per file. Writing each tick straight
  // to `form` would re-render the whole wizard on every chunk, so the latest
  // fraction is parked here and flushed on a frame.
  const pendingProgress = useRef<Map<string, number>>(new Map());
  const flushScheduled = useRef(false);

  // descriptionState already reactively holds the current text (it's the
  // native binding for the TextField), so we read from it directly instead
  // of keeping a separate plain-useState copy in sync.
  const descriptionValue = descriptionState.value;

  const patchAttachment = useCallback(
    (id: string, patch: Partial<Attachment>) => {
      setForm((prev) => ({
        ...prev,
        attachments: prev.attachments.map((a) =>
          a.id === id ? { ...a, ...patch } : a,
        ),
      }));
    },
    [],
  );

  const flushProgress = useCallback(() => {
    if (flushScheduled.current) return;
    flushScheduled.current = true;
    requestAnimationFrame(() => {
      flushScheduled.current = false;
      const pending = pendingProgress.current;
      if (pending.size === 0) return;
      const snapshot = new Map(pending);
      pending.clear();
      setForm((prev) => ({
        ...prev,
        attachments: prev.attachments.map((a) =>
          snapshot.has(a.id) ? { ...a, progress: snapshot.get(a.id) } : a,
        ),
      }));
    });
  }, []);

  const startUpload = useCallback(
    async (attachment: Attachment) => {
      try {
        const uploaded = await attachmentService.upload(
          {
            uri: attachment.uri!,
            name: attachment.name,
            type: attachment.mimeType ?? "application/octet-stream",
          },
          (fraction) => {
            pendingProgress.current.set(attachment.id, fraction);
            flushProgress();
          },
        );
        pendingProgress.current.delete(attachment.id);
        patchAttachment(attachment.id, {
          status: "ready",
          progress: 1,
          remoteId: uploaded.id,
          url: uploaded.url ?? undefined,
          sizeBytes: uploaded.sizeBytes,
          error: undefined,
        });
      } catch (e: any) {
        pendingProgress.current.delete(attachment.id);
        const detail = e?.response?.data?.detail;
        console.log("attachment upload error", detail, e?.response?.status);
        patchAttachment(attachment.id, {
          status: "failed",
          progress: undefined,
          error:
            typeof detail === "string"
              ? detail
              : "Upload failed. Tap to retry.",
        });
      }
    },
    [flushProgress, patchAttachment],
  );

  const addAttachment = useCallback(
    (attachment: Attachment) => {
      if (!isUploadable(attachment)) {
        setForm((prev) => ({
          ...prev,
          attachments: [...prev.attachments, attachment],
        }));
        return;
      }

      // Checked against what's already in the form, before anything is sent —
      // a file over the cap should cost the user nothing but the tap. Read off
      // the rendered `form` rather than inside a setForm updater: the updater
      // runs during the re-render, not at call time, so a flag set in there is
      // still unset by the time control returns here.
      const total = form.attachments.reduce(
        (sum, a) => sum + (a.sizeBytes ?? 0),
        0,
      );
      const rejected = checkSize(
        attachment.kind as AttachmentKindApi,
        attachment.sizeBytes,
        total,
      );

      setForm((prev) => ({
        ...prev,
        attachments: [
          ...prev.attachments,
          rejected
            ? { ...attachment, status: "failed" as const, error: rejected }
            : { ...attachment, status: "uploading" as const, progress: 0 },
        ],
      }));

      if (!rejected) void startUpload(attachment);
    },
    [form.attachments, startUpload],
  );

  const removeAttachment = useCallback((id: string) => {
    setForm((prev) => {
      const target = prev.attachments.find((a) => a.id === id);
      // Fire-and-forget: the file is out of the user's form either way, and the
      // server sweeps anything that was never submitted with a brief.
      if (target?.remoteId != null)
        void attachmentService.remove(target.remoteId);
      return {
        ...prev,
        attachments: prev.attachments.filter((a) => a.id !== id),
      };
    });
  }, []);

  const retryAttachment = useCallback(
    (id: string) => {
      const target = form.attachments.find((a) => a.id === id);
      if (!target || !isUploadable(target)) return;

      // A file rejected on size never reached the network, and retrying it
      // would fail identically. Removing it is the only way forward.
      if (
        checkSize(target.kind as AttachmentKindApi, target.sizeBytes, 0) !==
        null
      ) {
        return;
      }

      patchAttachment(id, {
        status: "uploading",
        progress: 0,
        error: undefined,
      });
      void startUpload(target);
    },
    [form.attachments, patchAttachment, startUpload],
  );

  const setDurationMinutes = useCallback((durationMinutes: number) => {
    setForm((prev) => ({ ...prev, durationMinutes }));
  }, []);

  const setAudienceIndex = useCallback((audienceIndex: number) => {
    setForm((prev) => ({ ...prev, audienceIndex }));
  }, []);

  const setCardCount = useCallback((cardCount: number) => {
    setForm((prev) => ({ ...prev, cardCount }));
  }, []);

  const handleSetDescriptionValue = useCallback((text: string) => {
    setForm((prev) => ({ ...prev, description: text }));
  }, []);

  const setIsPublic = useCallback((isPublic: boolean) => {
    setForm((prev) => ({
      ...prev,
      isPublic,
    }));
  }, []);

  const isUploading = useMemo(
    () => form.attachments.some((a) => a.status === "uploading"),
    [form.attachments],
  );

  const attachmentIds = useMemo(
    () =>
      form.attachments
        .map((a) => a.remoteId)
        .filter((id): id is number => id != null),
    [form.attachments],
  );

  const value = useMemo<PresentationFormContextValue>(
    () => ({
      form,
      descriptionState,
      linkDraftState,
      descriptionValue,
      isUploading,
      attachmentIds,

      isPublic: form.isPublic,
      setIsPublic,

      addAttachment,
      removeAttachment,
      retryAttachment,
      setDurationMinutes,
      setAudienceIndex,
      setCardCount,
      handleSetDescriptionValue,
    }),
    [
      form,
      descriptionState,
      linkDraftState,
      descriptionValue,
      isUploading,
      attachmentIds,
      setIsPublic,
      addAttachment,
      removeAttachment,
      retryAttachment,
      setDurationMinutes,
      setAudienceIndex,
      setCardCount,
      handleSetDescriptionValue,
    ],
  );

  return (
    <PresentationFormContext.Provider value={value}>
      {children}
    </PresentationFormContext.Provider>
  );
}

export function usePresentationForm() {
  const ctx = useContext(PresentationFormContext);
  if (!ctx) {
    throw new Error(
      "usePresentationForm must be used within a PresentationFormProvider",
    );
  }
  return ctx;
}
