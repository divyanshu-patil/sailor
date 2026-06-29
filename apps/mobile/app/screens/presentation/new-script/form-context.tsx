import { createContext, useContext, useState, ReactNode } from "react";
import { useNativeState } from "@expo/ui/swift-ui";
import {
  PresentationFormState,
  Attachment,
  DEFAULT_STATE,
} from "./types/types";

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
  setDescriptionValue: (text: string) => void;
};

const PresentationFormContext = createContext<
  PresentationFormContextValue | undefined
>(undefined);

export function PresentationFormProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [form, setForm] = useState<PresentationFormState>(DEFAULT_STATE);
  const descriptionState = useNativeState("");
  const [descriptionValue, setDescriptionValue] = useState("");
  const linkDraftState = useNativeState("");

  const value: PresentationFormContextValue = {
    form,
    descriptionState,
    linkDraftState,
    descriptionValue,
    addAttachment: (attachment) =>
      setForm((prev) => ({
        ...prev,
        attachments: [...prev.attachments, attachment],
      })),
    removeAttachment: (id) =>
      setForm((prev) => ({
        ...prev,
        attachments: prev.attachments.filter((a) => a.id !== id),
      })),
    setDurationMinutes: (durationMinutes) =>
      setForm((prev) => ({ ...prev, durationMinutes })),
    setAudienceIndex: (audienceIndex) =>
      setForm((prev) => ({ ...prev, audienceIndex })),
    setCardCount: (cardCount) => setForm((prev) => ({ ...prev, cardCount })),
    setDescriptionValue: (text) => setDescriptionValue(text),
  };

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
