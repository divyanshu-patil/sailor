import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useMemo,
  useCallback,
} from "react";
import { useNativeState } from "@expo/ui/swift-ui";
import { PresentationFormState, DEFAULT_STATE } from "./types/types";
import { Attachment } from "@/types/presentation";

// ---- Context -----------------------------------------------------------

type PresentationFormContextValue = {
  form: PresentationFormState;
  // SwiftUI TextField requires an ObservableState (from useNativeState),
  // not a plain string — these live in context so they survive the step
  // unmounting/remounting as the user moves back and forth.
  descriptionState: ReturnType<typeof useNativeState<string>>;
  linkDraftState: ReturnType<typeof useNativeState<string>>;
  descriptionValue: string;
  addAttachment: (attachment: Attachment) => void;
  removeAttachment: (id: string) => void;
  setDurationMinutes: (value: number) => void;
  setAudienceIndex: (value: number) => void;
  setCardCount: (value: number) => void;
  handleSetDescriptionValue: (text: string) => void;
};

const PresentationFormContext =
  createContext<PresentationFormContextValue | null>(null);

export function PresentationFormProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [form, setForm] = useState<PresentationFormState>(DEFAULT_STATE);
  const descriptionState = useNativeState("");
  const linkDraftState = useNativeState("");

  // descriptionState already reactively holds the current text (it's the
  // native binding for the TextField), so we read from it directly instead
  // of keeping a separate plain-useState copy in sync.
  const descriptionValue = descriptionState.value;

  const addAttachment = useCallback((attachment: Attachment) => {
    setForm((prev) => ({
      ...prev,
      attachments: [...prev.attachments, attachment],
    }));
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setForm((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((a) => a.id !== id),
    }));
  }, []);

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

  const value = useMemo<PresentationFormContextValue>(
    () => ({
      form,
      descriptionState,
      linkDraftState,
      descriptionValue,
      addAttachment,
      removeAttachment,
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
      addAttachment,
      removeAttachment,
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
