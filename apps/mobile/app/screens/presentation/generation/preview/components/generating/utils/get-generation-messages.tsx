import { DeckGenerationStatus } from "@/services/deck-generation.service";
import { generatingMessages } from "../constants";

const IN_PROGRESS_MESSAGES: Record<string, string[]> = {
  pending: generatingMessages,
  processing: generatingMessages,
  revising: generatingMessages,
  generating_cards: generatingMessages,
};

export const getGeneratingMessages = (
  status: DeckGenerationStatus | undefined,
  title?: string,
): string[] => {
  if (!status) return generatingMessages;

  if (status === "failed") {
    return ["Failed to Generate Script, try again later"];
  }
  if (status === "cancelled") {
    return ["Cancelled"];
  }
  if (status === "completed" && title) {
    return [title];
  }
  if (status in IN_PROGRESS_MESSAGES) {
    return IN_PROGRESS_MESSAGES[status];
  }
  // script_ready with no title yet, or any other in-between state
  return generatingMessages;
};
