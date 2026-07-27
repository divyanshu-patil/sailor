import { useCallback, useEffect, useRef, useState } from "react";

export type JobState =
  | "idle"
  | "generating"
  | "completed"
  | "failed"
  | "cancelled";

interface JobStatusLike<TResult> {
  // "retrying" is written by the Celery tasks between attempts; it's just
  // another in-progress state as far as the poller is concerned.
  status: "pending" | "processing" | "retrying" | "completed" | "failed";
  error?: string;
  /** Set when the status endpoint returns the finished payload inline, which
   *  saves the extra getResult round trip. */
  result?: TResult;
}

interface UseJobPollerOptions<TResult> {
  pollIntervalMs?: number;
  getStatus: (jobId: string) => Promise<JobStatusLike<TResult>>;
  getResult: (jobId: string) => Promise<TResult>;
  /** Optional: the API has no cancel route today, so `stop()` is client-side
   *  only — it stops polling but leaves the job running server-side. */
  cancelJob?: (jobId: string) => Promise<void>;
}

/**
 * Generic "kick off a job -> poll status -> fetch result" state machine.
 * Extracted so script generation and deck generation (and anything else
 * that follows this same job lifecycle) can share one implementation
 * instead of copy-pasting the polling logic.
 */
export function useJobPoller<TResult>({
  pollIntervalMs = 2000,
  getStatus,
  getResult,
  cancelJob,
}: UseJobPollerOptions<TResult>) {
  const [state, setState] = useState<JobState>("idle");
  const [result, setResult] = useState<TResult | null>(null);
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

  const poll = useCallback(
    async (jobId: string) => {
      if (stoppedRef.current) return;

      try {
        const statusRes = await getStatus(jobId);

        if (stoppedRef.current) return;

        if (statusRes.status === "completed") {
          const fullResult = statusRes.result ?? (await getResult(jobId));
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

        // still pending/processing/retrying — poll again via the ref, not the closure
        timeoutRef.current = setTimeout(() => {
          pollRef.current?.(jobId);
        }, pollIntervalMs);
      } catch {
        if (stoppedRef.current) return;
        setError("Something went wrong while checking generation status");
        setState("failed");
      }
    },
    [getStatus, getResult, pollIntervalMs],
  );

  // Keep the ref pointed at the latest poll implementation
  useEffect(() => {
    pollRef.current = poll;
  }, [poll]);

  /**
   * kickoff() is whatever call actually starts the job server-side
   * (e.g. scriptService.generate, or scriptService.confirm). It just
   * needs to resolve with a job_id.
   */
  const start = useCallback(
    async (kickoff: () => Promise<{ job_id: string }>) => {
      stoppedRef.current = false;
      setError(null);
      setResult(null);
      setState("generating");

      try {
        const { job_id } = await kickoff();
        jobIdRef.current = job_id;
        pollRef.current?.(job_id);
        return job_id;
      } catch (e) {
        setError("Couldn't start generation");
        setState("failed");
        throw e;
      }
    },
    [],
  );

  /**
   * Attach to a job that's already running server-side (e.g. a screen
   * mounted after another screen already called `start`). Same as `start`
   * but skips the kickoff call — just begins polling an existing job_id.
   */
  const attach = useCallback((jobId: string) => {
    stoppedRef.current = false;
    setError(null);
    setResult(null);
    setState("generating");
    jobIdRef.current = jobId;
    pollRef.current?.(jobId);
  }, []);

  const stop = useCallback(async () => {
    stoppedRef.current = true;
    clearPoll();

    if (jobIdRef.current && cancelJob) {
      try {
        await cancelJob(jobIdRef.current);
      } catch {
        // best-effort — even if cancel fails server-side, stop the UI
      }
    }

    setState("cancelled");
  }, [cancelJob]);

  useEffect(() => {
    return () => clearPoll(); // cleanup on unmount
  }, []);

  // Expose setResult for external use (e.g., for revise operations)
  const handleSetResult = useCallback((newResult: TResult) => {
    setResult(newResult);
  }, []);

  return { state, result, error, jobIdRef, start, attach, stop, setResult: handleSetResult };
}
