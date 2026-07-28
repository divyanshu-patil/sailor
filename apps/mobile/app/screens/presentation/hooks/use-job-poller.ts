import { useCallback, useEffect, useRef, useState } from "react";

export type JobState =
  | "idle"
  | "generating"
  | "completed"
  | "failed"
  | "cancelled";

interface JobStatusLike<TResult> {
  // "retrying" is written by the Celery tasks between attempts; it's just
  // another in-progress state as far as the poller is concerned. "cancelled"
  // only ever arrives after this client asked for it.
  status:
    | "pending"
    | "processing"
    | "retrying"
    | "completed"
    | "failed"
    | "cancelled";
  error?: string;
  /** Set when the status endpoint returns the finished payload inline, which
   *  saves the extra getResult round trip. */
  result?: TResult;
}

interface UseJobPollerOptions<TResult> {
  pollIntervalMs?: number;
  getStatus: (jobId: string) => Promise<JobStatusLike<TResult>>;
  getResult: (jobId: string) => Promise<TResult>;
  /** Terminates the job server-side. Without one, `stop()` only stops polling
   *  and the provider keeps generating a script nobody is waiting for. */
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

        if (statusRes.status === "cancelled") {
          // Terminal, and not an error: stop polling without setting one.
          stoppedRef.current = true;
          setState("cancelled");
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
   * kickoff() is whatever call actually starts the job server-side. It just
   * needs to resolve with a job_id.
   */
  const start = useCallback(
    async (kickoff: () => Promise<{ job_id: string }>) => {
      // Any chain already scheduled has to die here, or start/attach/retry each
      // add a second concurrent chain on the same job and the request rate
      // doubles per call.
      clearPoll();
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
    clearPoll();
    stoppedRef.current = false;
    setError(null);
    setResult(null);
    setState("generating");
    jobIdRef.current = jobId;
    pollRef.current?.(jobId);
  }, []);

  const stop = useCallback(async () => {
    // Flip the UI to "cancelled" before awaiting the round trip, not after: the
    // user tapped Stop and the screen has to acknowledge that immediately, and
    // the request below is best-effort anyway.
    stoppedRef.current = true;
    clearPoll();
    setState("cancelled");

    if (jobIdRef.current && cancelJob) {
      try {
        await cancelJob(jobIdRef.current);
      } catch {
        // Best-effort. A failed cancel leaves the job running server-side, but
        // there's nothing useful to show the user here — the deck's own status
        // is still the source of truth next time they open it.
      }
    }
  }, [cancelJob]);

  /**
   * Re-run a job that failed or was cancelled, on the same id.
   *
   * Separate from `start` because there's no kickoff payload to re-supply: the
   * backend still has the original brief, so "Try again" is a re-queue rather
   * than a new submission.
   */
  const retry = useCallback(
    async (retryJob: (jobId: string) => Promise<{ job_id: string }>) => {
      const jobId = jobIdRef.current;
      if (!jobId) return undefined;

      clearPoll();
      stoppedRef.current = false;
      setError(null);
      setResult(null);
      setState("generating");

      try {
        await retryJob(jobId);
        pollRef.current?.(jobId);
        return jobId;
      } catch (e) {
        setError("Couldn't restart generation");
        setState("failed");
        throw e;
      }
    },
    [],
  );

  useEffect(() => {
    return () => clearPoll(); // cleanup on unmount
  }, []);

  /**
   * Publish a result the caller already has, without polling for it.
   *
   * Two callers need this: resuming a job that finished while the app was
   * elsewhere, and a manual edit, which returns the new script synchronously.
   * Both are "the job is done and here is the answer", so this settles the state
   * as well as the value — setting only the result left the screen rendering its
   * generating state over a script that had already arrived.
   *
   * Any in-flight poll chain is torn down: it can only be about to report the
   * same terminal state, and letting it land would overwrite a fresher result
   * with a staler one.
   */
  const handleSetResult = useCallback((newResult: TResult) => {
    stoppedRef.current = true;
    clearPoll();
    setResult(newResult);
    setError(null);
    setState("completed");
  }, []);

  return {
    state,
    result,
    error,
    jobIdRef,
    start,
    attach,
    stop,
    retry,
    setResult: handleSetResult,
  };
}
