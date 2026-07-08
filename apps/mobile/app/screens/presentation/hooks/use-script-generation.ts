import { useCallback, useEffect, useRef, useState } from "react";
// import {
//   scriptService,
//   GenerateScriptPayload,
//   ScriptResult,
// } from "@/services/script.service";
import {
  scriptService,
  GenerateScriptPayload,
  ScriptResult,
} from "@/services/script.debug.service";

const POLL_INTERVAL_MS = 2000;

export type GenerationState =
  | "idle"
  | "generating"
  | "completed"
  | "failed"
  | "cancelled";

export function useScriptGeneration() {
  const [state, setState] = useState<GenerationState>("idle");
  const [result, setResult] = useState<ScriptResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const jobIdRef = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppedRef = useRef(false);

  // Holds the latest poll function so the recursive setTimeout call
  // never references `poll` directly inside its own closure.
  const pollRef = useRef<(jobId: string) => Promise<void>>(undefined);

  const clearPoll = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const poll = useCallback(async (jobId: string) => {
    if (stoppedRef.current) return;

    try {
      const statusRes = await scriptService.getJobStatus(jobId);

      if (stoppedRef.current) return;

      if (statusRes.status === "completed") {
        const fullResult = await scriptService.getResult(jobId);
        if (stoppedRef.current) return;
        setResult(fullResult);
        setState("completed");
        return;
      }

      if (statusRes.status === "failed") {
        setError(statusRes.error ?? "Generation failed");
        setState("failed");
        return;
      }

      if (statusRes.status === "cancelled") {
        setState("cancelled");
        return;
      }

      // still pending/processing — poll again via the ref, not the closure
      timeoutRef.current = setTimeout(() => {
        pollRef.current?.(jobId);
      }, POLL_INTERVAL_MS);
    } catch {
      if (stoppedRef.current) return;
      setError("Something went wrong while checking generation status");
      setState("failed");
    }
  }, []);

  // Keep the ref pointed at the latest poll implementation
  useEffect(() => {
    pollRef.current = poll;
  }, [poll]);

  const startGeneration = useCallback(
    async (payload: GenerateScriptPayload) => {
      console.log("started generation");

      stoppedRef.current = false;
      setError(null);
      setResult(null);
      setState("generating");

      try {
        const { job_id } = await scriptService.generate(payload);
        jobIdRef.current = job_id;
        pollRef.current?.(job_id);
      } catch {
        setError("Couldn't start generation");
        setState("failed");
      }
    },
    [],
  );

  const stopGeneration = useCallback(async () => {
    console.log("stopped generation");
    stoppedRef.current = true;
    clearPoll();

    if (jobIdRef.current) {
      try {
        await scriptService.cancelJob(jobIdRef.current);
      } catch {
        // best-effort — even if cancel fails server-side, stop the UI
      }
    }

    setState("cancelled");
  }, []);

  useEffect(() => {
    return () => clearPoll(); // cleanup on unmount
  }, []);

  return { state, result, error, startGeneration, stopGeneration };
}
