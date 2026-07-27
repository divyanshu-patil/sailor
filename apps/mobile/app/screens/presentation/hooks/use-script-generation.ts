import { useCallback, useState } from "react";
import { useJobPoller } from "./use-job-poller";
import {
  GenerateScriptPayload,
  ScriptResult,
  DeckResult,
  scriptService,
} from "@/services/script.service";

export type { JobState as GenerationState } from "./use-job-poller";

/**
 * Phase one: create the deck (which queues the script job) and poll
 * /decks/{id}/status until the script is written.
 *
 * There's no cancel route on the API, so `stopGeneration` only stops the
 * client polling — the worker finishes the script regardless and the deck is
 * still there when the user comes back to it.
 */
export function useScriptGeneration() {
  const poller = useJobPoller<ScriptResult>({
    getStatus: scriptService.getJobStatus,
    getResult: scriptService.getResult,
  });

  const [isRevising, setIsRevising] = useState(false);

  const startGeneration = useCallback(
    (payload: GenerateScriptPayload) => {
      console.log("started generation");
      return poller.start(() => scriptService.generate(payload));
    },
    [poller],
  );

  const stopGeneration = useCallback(() => {
    console.log("stopped generation");
    return poller.stop();
  }, [poller]);

  /**
   * AI revision runs as a job on the same deck, so this hands control back to
   * the poller rather than resolving with the new script itself — the revised
   * script arrives through `result`, exactly like the first generation did.
   */
  const revise = useCallback(
    async (instruction: string): Promise<boolean> => {
      const jobId = poller.jobIdRef.current;
      if (!jobId) return false;

      setIsRevising(true);
      try {
        await scriptService.revise(jobId, instruction);
        poller.attach(jobId);
        return true;
      } catch {
        // Error is handled by the caller
        return false;
      } finally {
        setIsRevising(false);
      }
    },
    [poller],
  );

  /** Manual edit — a plain PATCH, so the new script comes straight back. */
  const edit = useCallback(
    async (script: string): Promise<ScriptResult | undefined> => {
      const jobId = poller.jobIdRef.current;
      if (!jobId) return undefined;

      setIsRevising(true);
      try {
        const result = await scriptService.edit(jobId, script);
        poller.setResult(result);
        return result;
      } catch {
        // Error is handled by the caller
        return undefined;
      } finally {
        setIsRevising(false);
      }
    },
    [poller],
  );

  // Expose attach for editing existing jobs
  const attach = useCallback(
    (jobId: string) => {
      poller.attach(jobId);
    },
    [poller],
  );

  return {
    state: poller.state,
    result: poller.result,
    error: poller.error,
    startGeneration,
    stopGeneration,
    revise,
    edit,
    attach,
    isRevising,
  };
}

/**
 * Phase two: turn a finished script into cards. Kicked off from the preview
 * screen's "Create" via POST /decks/{id}/cards/generate and polled on
 * /decks/{id}/cards/status — the deck id doubles as the card job id, so
 * `startDeckGeneration` resolves with the same id the script job used.
 *
 * `getDeckResult` returns the full deck payload (title, color, slideCount,
 * ...) so ResultsScreen can build its Link params directly off `result`.
 */
export function useDeckGeneration() {
  const poller = useJobPoller<DeckResult>({
    getStatus: scriptService.getCardsJobStatus,
    getResult: scriptService.getDeckResult,
  });

  const startDeckGeneration = useCallback(
    (scriptJobId: string) => {
      console.log("started deck generation");
      return poller.start(() => scriptService.confirm(scriptJobId));
    },
    [poller],
  );

  const resumeDeckGeneration = useCallback(
    (deckJobId: string) => poller.attach(deckJobId),
    [poller],
  );

  const stopDeckGeneration = useCallback(() => poller.stop(), [poller]);

  return {
    state: poller.state,
    result: poller.result,
    error: poller.error,
    startDeckGeneration,
    resumeDeckGeneration,
    stopDeckGeneration,
  };
}
