import { GenerationState } from "../../../../../hooks/use-script-generation";
import { generatingMessages } from "../constants";

export const getGeneratingMessages = (
  status: GenerationState,
  title?: string,
): string[] => {
  if (status === "failed") {
    return ["Failed to Generate Script, try again later"];
  } else if (status === "generating") {
    return generatingMessages;
  } else if (status === "cancelled") {
    return ["cancelled"];
  } else if (status === "completed" && title) {
    return [title];
  } else return generatingMessages;
};
