import { useCallback, useState, useEffect, useRef } from "react";
import {
  scriptService,
  GenerateScriptPayload,
  GenerateScriptResponse,
  ScriptJobStatus,
  ScriptJobStatusResponse,
  ScriptResult,
  DeckResult,
} from "@/services/script.service";
import { useApiState, UseApiStateReturn } from "./use-api-state";

/**
 * Hook for script generation operations.
 * Includes polling for job status and fetching results.
 */

export interface UseScriptGenerationOptions {
  /** Existing jobId to work with (for edit/revise flows) */
  jobId?: string;
  /** Callback on successful generation start */
  onSuccess?: (response: GenerateScriptResponse) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
  /** Callback on job completion */
  onJobComplete?: (result: ScriptResult) => void;
  /** Polling interval in ms */
  pollInterval?: number;
  /** Maximum polling attempts */
  maxPollAttempts?: number;
}

export interface UseScriptGenerationReturn {
  /** The initial response with job_id */
  generationResponse: GenerateScriptResponse | undefined;
  /** Current job status */
  jobStatus: ScriptJobStatusResponse | undefined;
  /** The completed script result */
  result: ScriptResult | undefined;
  /** The deck result (if generated deck) */
  deckResult: DeckResult | undefined;
  /** Whether generation is in progress */
  isGenerating: boolean;
  /** Whether we're polling for job status */
  isPolling: boolean;
  /** Whether the job has completed */
  isComplete: boolean;
  /** Error message */
  error: string | null;
  /** Start script generation */
  generate: (payload: GenerateScriptPayload) => Promise<void>;
  /** Poll for job status */
  pollStatus: () => Promise<void>;
  /** Cancel the job */
  cancelJob: () => Promise<void>;
  /** Revise the script */
  revise: (instruction: string) => Promise<ScriptResult | undefined>;
  /** Edit the script */
  edit: (script: string) => Promise<ScriptResult | undefined>;
  /** Confirm the script */
  confirm: () => Promise<void>;
  /** Fetch the result */
  fetchResult: () => Promise<void>;
  /** Fetch the deck result */
  fetchDeckResult: () => Promise<void>;
  /** Reset state */
  reset: () => void;
}

/**
 * Hook for managing script generation lifecycle.
 * Handles generation start, polling for status, and fetching results.
 */
export function useScriptGeneration(
  options: UseScriptGenerationOptions = {},
): UseScriptGenerationReturn {
  const {
    jobId: initialJobId,
    onSuccess,
    onError,
    onJobComplete,
    pollInterval = 2000,
    maxPollAttempts = 150, // 5 minutes max
  } = options;

  const [generationResponse, setGenerationResponse] = useState<GenerateScriptResponse | undefined>(
    initialJobId ? { job_id: initialJobId, status: "pending", type: "script" } : undefined,
  );
  const [jobStatus, setJobStatus] = useState<ScriptJobStatusResponse | undefined>();
  const [result, setResult] = useState<ScriptResult | undefined>();
  const [deckResult, setDeckResult] = useState<DeckResult | undefined>();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pollAttemptsRef = useRef(0);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const reset = useCallback(() => {
    setGenerationResponse(undefined);
    setJobStatus(undefined);
    setResult(undefined);
    setDeckResult(undefined);
    setIsGenerating(false);
    setIsPolling(false);
    setIsComplete(false);
    setError(null);
    pollAttemptsRef.current = 0;
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const generate = useCallback(
    async (payload: GenerateScriptPayload): Promise<void> => {
      setIsGenerating(true);
      setError(null);

      try {
        const response = await scriptService.generate(payload);
        setGenerationResponse(response);
        onSuccess?.(response);

        // Start polling if status is pending or processing
        if (response.status === "pending" || response.status === "processing") {
          // Poll immediately, then on interval
          pollAttemptsRef.current = 0;
          const poll = async () => {
            try {
              const status = await scriptService.getJobStatus(response.job_id);
              setJobStatus(status);

              if (status.status === "completed") {
                setIsComplete(true);
                if (pollingRef.current) {
                  clearInterval(pollingRef.current);
                  pollingRef.current = null;
                }
                // Fetch the result
                const scriptResult = await scriptService.getResult(response.job_id);
                setResult(scriptResult);
                onJobComplete?.(scriptResult);
              } else if (status.status === "failed" || status.status === "cancelled") {
                setError(status.error || `Job ${status.status}`);
                if (pollingRef.current) {
                  clearInterval(pollingRef.current);
                  pollingRef.current = null;
                }
              } else if (pollAttemptsRef.current < maxPollAttempts) {
                pollAttemptsRef.current++;
                pollingRef.current = setTimeout(poll, pollInterval);
              } else {
                setError("Job polling timed out");
              }
            } catch (err: any) {
              setError(err?.message || "Failed to poll job status");
            }
          };
          poll();
        }
      } catch (err: any) {
        const errorMessage = err?.response?.data?.message || err?.message || "Generation failed";
        setError(errorMessage);
        onError?.(err);
      } finally {
        setIsGenerating(false);
        setIsPolling(true);
      }
    },
    [onSuccess, onError, onJobComplete, pollInterval, maxPollAttempts],
  );

  const pollStatus = useCallback(async () => {
    if (!generationResponse) return;

    setIsPolling(true);
    setError(null);

    try {
      const status = await scriptService.getJobStatus(generationResponse.job_id);
      setJobStatus(status);

      if (status.status === "completed") {
        setIsComplete(true);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to poll job status");
    } finally {
      setIsPolling(false);
    }
  }, [generationResponse]);

  const cancelJob = useCallback(async () => {
    if (!generationResponse) return;

    try {
      await scriptService.cancelJob(generationResponse.job_id);
      reset();
    } catch (err: any) {
      setError(err?.message || "Failed to cancel job");
    }
  }, [generationResponse, reset]);

  const revise = useCallback(
    async (instruction: string): Promise<ScriptResult | undefined> => {
      if (!generationResponse) return;

      setIsGenerating(true);
      setError(null);

      try {
        const newResult = await scriptService.revise(generationResponse.job_id, instruction);
        setResult(newResult);
        return newResult;
      } catch (err: any) {
        setError(err?.message || "Failed to revise script");
        onError?.(err);
        return undefined;
      } finally {
        setIsGenerating(false);
      }
    },
    [generationResponse, onError],
  );

  const edit = useCallback(
    async (script: string): Promise<ScriptResult | undefined> => {
      if (!generationResponse) return;

      setIsGenerating(true);
      setError(null);

      try {
        const newResult = await scriptService.edit(generationResponse.job_id, script);
        setResult(newResult);
        return newResult;
      } catch (err: any) {
        setError(err?.message || "Failed to edit script");
        onError?.(err);
        return undefined;
      } finally {
        setIsGenerating(false);
      }
    },
    [generationResponse, onError],
  );

  const confirm = useCallback(async () => {
    if (!generationResponse) return;

    setIsGenerating(true);
    setError(null);

    try {
      await scriptService.confirm(generationResponse.job_id);
    } catch (err: any) {
      setError(err?.message || "Failed to confirm script");
      onError?.(err);
    } finally {
      setIsGenerating(false);
    }
  }, [generationResponse, onError]);

  const fetchResult = useCallback(async () => {
    if (!generationResponse) return;

    setIsGenerating(true);
    setError(null);

    try {
      const scriptResult = await scriptService.getResult(generationResponse.job_id);
      setResult(scriptResult);
      setIsComplete(true);
    } catch (err: any) {
      setError(err?.message || "Failed to fetch result");
      onError?.(err);
    } finally {
      setIsGenerating(false);
    }
  }, [generationResponse, onError]);

  const fetchDeckResult = useCallback(async () => {
    if (!generationResponse) return;

    setIsGenerating(true);
    setError(null);

    try {
      const deck = await scriptService.getDeckResult(generationResponse.job_id);
      setDeckResult(deck);
    } catch (err: any) {
      setError(err?.message || "Failed to fetch deck result");
      onError?.(err);
    } finally {
      setIsGenerating(false);
    }
  }, [generationResponse, onError]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  return {
    generationResponse,
    jobStatus,
    result,
    deckResult,
    isGenerating,
    isPolling,
    isComplete,
    error,
    generate,
    pollStatus,
    cancelJob,
    revise,
    edit,
    confirm,
    fetchResult,
    fetchDeckResult,
    reset,
  };
}