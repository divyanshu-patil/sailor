import { GenerationState } from "../../../../../hooks/use-script-generation";
import { generatingMessages } from "../constants";

export const getGeneratingMessages = (
  status: GenerationState,
  title?: string,
  error?: string | null,
  /** What failed, for the message. The results screen builds a deck, not a
   *  script, and reporting "couldn't generate script" there sent the user
   *  looking for a problem with a script that was already finished. */
  subject: string = "script",
): string[] => {
  // Checked before `status` because a rejected revise — a 409 while a job is
  // already running, a 400 with no script yet — leaves the state on "completed"
  // and would otherwise be invisible. The backend puts the real cause in
  // `generation_error`/`detail`; the old fixed string threw all of it away and
  // made every failure read as an unexplained "try again later".
  if (error) {
    return [error];
  }
  if (status === "failed") {
    return [`Couldn't finish your ${subject}`];
  } else if (status === "generating") {
    return generatingMessages;
  } else if (status === "cancelled") {
    return ["Stopped"];
  } else if (status === "completed" && title) {
    return [title];
  } else return generatingMessages;
};
