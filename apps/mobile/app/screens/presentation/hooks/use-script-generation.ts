import { useCallback } from "react";
import { useJobPoller } from "./use-job-poller";
import { scriptService } from "@/services/script.debug.service";
import { GenerateScriptPayload, ScriptResult } from "@/services/script.service";

export type { JobState as GenerationState } from "./use-job-poller";

/**
 * Unchanged public API — PreviewScreen keeps working exactly as before.
 * Internally this now just configures the generic poller with the
 * script-specific service calls.
 */
export function useScriptGeneration() {
  const poller = useJobPoller<ScriptResult>({
    getStatus: scriptService.getJobStatus,
    getResult: scriptService.getResult,
    cancelJob: scriptService.cancelJob,
  });

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

  return {
    state: poller.state,
    result: poller.result,
    error: poller.error,
    startGeneration,
    stopGeneration,
  };
}

/**
 * Deck generation kicked off from a *ready* script via the new
 * /confirm route. Reuses the exact same poll/status/result machinery —
 * just wired to different endpoints.
 *
 * NOTE / ASSUMPTION: `scriptService.getDeckResult` doesn't exist yet in
 * your service file — I'm assuming the deck's final payload comes from
 * a separate endpoint (stubbed below as `/deck-result`). If deck results
 * actually come back from the same `/result` endpoint, just point
 * getResult at `scriptService.getResult` instead and drop the stub.
 */
export function useDeckGeneration() {
  const poller = useJobPoller<{ id: string; job_id: string }>({
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

  const stopDeckGeneration = useCallback(() => poller.stop(), [poller]);

  return {
    state: poller.state,
    // result.id / result.job_id is the deck id to navigate with
    result: poller.result,
    error: poller.error,
    startDeckGeneration,
    stopDeckGeneration,
  };
}
