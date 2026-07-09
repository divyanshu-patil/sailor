import { useCallback, useState } from "react";
import { useJobPoller } from "./use-job-poller";
import { scriptService } from "@/services/script.debug.service";
import {
  GenerateScriptPayload,
  ScriptResult,
  DeckResult,
} from "@/services/script.service";

export type { JobState as GenerationState } from "./use-job-poller";

export function useScriptGeneration() {
  const poller = useJobPoller<ScriptResult>({
    getStatus: scriptService.getJobStatus,
    getResult: scriptService.getResult,
    cancelJob: scriptService.cancelJob,
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

  const revise = useCallback(
    async (instruction: string): Promise<ScriptResult | undefined> => {
      const jobId = poller.jobIdRef.current;
      if (!jobId) return undefined;

      setIsRevising(true);
      try {
        const result = await scriptService.revise(jobId, instruction);
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
 * Deck generation kicked off from a *ready* script via the /confirm route.
 * `getDeckResult` now returns the full deck payload (title, color,
 * slideCount, etc.) so ResultsScreen can build its Link params directly
 * off `result` without a second `deckService.getDeck()` fetch.
 */
export function useDeckGeneration() {
  const poller = useJobPoller<DeckResult>({
    getStatus: scriptService.getJobStatus,
    getResult: scriptService.getDeckResult,
    cancelJob: scriptService.cancelJob,
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
