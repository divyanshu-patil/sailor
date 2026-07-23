import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/expo";
import {
  deckGenerationService,
  ACTIVE_STATUSES,
  GenerateDeckPayload,
  DeckResponse,
  DeckWsEvent,
  DeckGenerationStatus,
  isDeckGenerationStatus,
} from "@/services/deck-generation.service";

export interface UseDeckGenerationOptions {
  deckId?: number | string;
  onSuccess?: (deck: DeckResponse) => void;
  onError?: (error: Error) => void;
  /** Fires when generation_status lands on "completed" (cards done). */
  onComplete?: (deck: DeckResponse) => void;
  /** Fires when generation_status lands on "script_ready" (paused for user). */
  onScriptReady?: (deck: DeckResponse) => void;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

export interface UseDeckGenerationReturn {
  deck: DeckResponse | undefined;
  status: DeckGenerationStatus | undefined;
  progress: number | undefined;
  isGenerating: boolean;
  isRevising: boolean;
  isConfirming: boolean;
  isEditing: boolean;
  isCancelling: boolean;
  isConnected: boolean;
  isScriptReady: boolean;
  isComplete: boolean;
  error: string | null;
  generate: (payload: GenerateDeckPayload) => Promise<void>;
  revise: (instruction: string) => Promise<void>;
  edit: (script: string) => Promise<void>;
  confirm: () => Promise<void>;
  cancel: () => Promise<void>;
  fetchDeck: () => Promise<void>;
  reset: () => void;
}

export function useDeckGeneration(
  options: UseDeckGenerationOptions = {},
): UseDeckGenerationReturn {
  const {
    deckId: initialDeckId,
    onSuccess,
    onError,
    onComplete,
    onScriptReady,
    reconnectDelay = 2000,
    maxReconnectAttempts = 5,
  } = options;

  const { getToken } = useAuth();

  const [deckId, setDeckId] = useState<number | string | undefined>(
    initialDeckId,
  );
  const [deck, setDeck] = useState<DeckResponse | undefined>();
  const [status, setStatus] = useState<DeckGenerationStatus | undefined>();
  const [progress, setProgress] = useState<number | undefined>();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRevising, setIsRevising] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldReconnectRef = useRef(false);
  const connectTokenRef = useRef(0);
  const openSocketRef =
    useRef<(id: number | string) => Promise<void>>(undefined);

  const clearReconnectTimer = () => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  };

  const closeSocket = useCallback(() => {
    shouldReconnectRef.current = false;
    connectTokenRef.current += 1;
    clearReconnectTimer();
    if (socketRef.current) {
      socketRef.current.onopen = null;
      socketRef.current.onmessage = null;
      socketRef.current.onerror = null;
      socketRef.current.onclose = null;
      socketRef.current.close();
      socketRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const openSocket = useCallback(
    async (id: number | string) => {
      const attemptId = ++connectTokenRef.current;

      let token: string | null;
      try {
        token = await getToken();
      } catch {
        token = null;
      }

      if (attemptId !== connectTokenRef.current) return;

      if (!token) {
        setError("Not authenticated");
        return;
      }

      shouldReconnectRef.current = true;
      const ws = deckGenerationService.connectProgressSocket(id, token);
      socketRef.current = ws;

      let handshakeFailed = false;

      ws.onopen = () => {
        reconnectAttemptsRef.current = 0;
        setIsConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const payload: DeckWsEvent = JSON.parse(event.data);
          const rawStatus = payload.status; // DeckGenerationStatus | DeckWsTransientEvent

          console.log(
            "[ws] parsed status:",
            rawStatus,
            "has deck:",
            !!payload.deck,
            "script length:",
            payload.deck?.script?.length,
          );

          if (typeof payload.progress === "number")
            setProgress(payload.progress);
          if (payload.deck) {
            console.log(
              "[ws] calling setDeck with script length:",
              payload.deck.script?.length,
            );
            setDeck(payload.deck);
            console.log("[ws] setDeck call completed");
          }

          // Only persisted statuses update `status` state — transient
          // events (retrying, revise_failed) never touch it.
          if (isDeckGenerationStatus(rawStatus)) {
            console.log("[ws] calling setStatus:", rawStatus);
            setStatus(rawStatus);
          }

          switch (rawStatus) {
            case "completed":
              if (payload.deck) {
                setIsComplete(true);
                setIsGenerating(false);
                setIsConfirming(false);
                onComplete?.(payload.deck);
              }
              break;
            case "script_ready":
              setIsGenerating(false);
              setIsRevising(false);
              if (payload.deck) onScriptReady?.(payload.deck);
              break;
            case "cancelled":
              setIsGenerating(false);
              setIsRevising(false);
              setIsConfirming(false);
              break;
            case "failed": {
              const message = payload.error || "Deck generation failed";
              setError(message);
              setIsGenerating(false);
              setIsRevising(false);
              setIsConfirming(false);
              onError?.(new Error(message));
              break;
            }
            case "revise_failed": {
              setError(payload.error || "Revision failed");
              setIsRevising(false);
              break;
            }
            case "retrying":
              break;
            default:
              break;
          }

          if (
            isDeckGenerationStatus(rawStatus) &&
            !ACTIVE_STATUSES.includes(rawStatus)
          ) {
            closeSocket();
          }
        } catch {
          // ignore malformed frames
        }
      };

      ws.onerror = () => {
        // A handshake-level rejection (CORS, auth middleware, 403, etc.)
        // typically fires onerror without a meaningful close code — treat
        // it as non-retryable rather than letting onclose's code-based
        // check silently classify it as "retry forever."
        handshakeFailed = true;
        setError("Connection error");
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        const noRetryCodes = [1000, 4401, 4404];
        const shouldRetry =
          shouldReconnectRef.current &&
          !handshakeFailed &&
          !noRetryCodes.includes(event.code) &&
          reconnectAttemptsRef.current < maxReconnectAttempts;

        if (shouldRetry) {
          reconnectAttemptsRef.current += 1;
          // Exponential backoff instead of a fixed delay — caps how fast
          // repeated failures can hammer the JS thread.
          const backoff =
            reconnectDelay * Math.pow(2, reconnectAttemptsRef.current - 1);
          reconnectTimerRef.current = setTimeout(() => {
            openSocketRef.current?.(id);
          }, backoff);
        } else if (handshakeFailed) {
          setError(
            "Could not connect — check your connection or sign in again",
          );
        }
      };
    },
    [
      closeSocket,
      getToken,
      maxReconnectAttempts,
      onComplete,
      onScriptReady,
      onError,
      reconnectDelay,
    ],
  );

  useEffect(() => {
    openSocketRef.current = openSocket;
  }, [openSocket]);

  const generate = useCallback(
    async (payload: GenerateDeckPayload): Promise<void> => {
      setIsGenerating(true);
      setError(null);
      setIsComplete(false);

      try {
        const created = await deckGenerationService.generate(payload);
        setDeck(created);
        setStatus(created.generation_status);
        setDeckId(created.id);
        onSuccess?.(created);

        if (!ACTIVE_STATUSES.includes(created.generation_status)) {
          setIsGenerating(false);
          if (created.generation_status === "completed") onComplete?.(created);
          if (created.generation_status === "failed") {
            setError(created.generation_error ?? "Deck generation failed");
          }
          return;
        }

        await openSocket(created.id);
      } catch (err: any) {
        const message =
          err?.response?.data?.message || err?.message || "Generation failed";
        setError(message);
        setIsGenerating(false);
        onError?.(err);
      }
    },
    [onSuccess, onComplete, onError, openSocket],
  );

  const revise = useCallback(
    async (instruction: string): Promise<void> => {
      if (!deckId) return;
      setIsRevising(true);
      setError(null);
      try {
        const updated = await deckGenerationService.revise(deckId, instruction);
        setDeck(updated);
        setStatus(updated.generation_status);
        // AI-driven -> watch it over the websocket like initial generation.
        await openSocket(deckId);
      } catch (err: any) {
        const message =
          err?.response?.data?.message ||
          err?.message ||
          "Failed to revise script";
        setError(message);
        setIsRevising(false);
        onError?.(err);
      }
    },
    [deckId, openSocket, onError],
  );

  const edit = useCallback(
    async (script: string): Promise<void> => {
      if (!deckId) return;
      setIsEditing(true);
      setError(null);
      try {
        // Synchronous overwrite — no task, no websocket round-trip.
        const updated = await deckGenerationService.edit(deckId, script);
        setDeck(updated);
        setStatus(updated.generation_status);
      } catch (err: any) {
        const message =
          err?.response?.data?.message ||
          err?.message ||
          "Failed to edit script";
        setError(message);
        onError?.(err);
      } finally {
        setIsEditing(false);
      }
    },
    [deckId, onError],
  );

  const confirm = useCallback(async (): Promise<void> => {
    if (!deckId) return;
    setIsConfirming(true);
    setError(null);
    try {
      const updated = await deckGenerationService.confirm(deckId);
      setDeck(updated);
      setStatus(updated.generation_status);
      // AI-driven -> watch card generation through to completed/failed.
      await openSocket(deckId);
    } catch (err: any) {
      const message =
        err?.response?.data?.message || err?.message || "Failed to confirm";
      setError(message);
      setIsConfirming(false);
      onError?.(err);
    }
  }, [deckId, openSocket, onError]);

  const cancel = useCallback(async (): Promise<void> => {
    if (!deckId) return;
    setIsCancelling(true);
    setError(null);
    try {
      const updated = await deckGenerationService.cancel(deckId);
      setDeck(updated);
      setStatus(updated.generation_status);
      setIsGenerating(false);
      setIsRevising(false);
      setIsConfirming(false);
      closeSocket();
    } catch (err: any) {
      setError(
        err?.response?.data?.message || err?.message || "Failed to cancel",
      );
      onError?.(err);
    } finally {
      setIsCancelling(false);
    }
  }, [deckId, closeSocket, onError]);

  const fetchDeck = useCallback(async () => {
    if (!deckId) return;
    try {
      const result = await deckGenerationService.getDeck(deckId);
      setDeck(result);
      setStatus(result.generation_status);
      setIsComplete(result.generation_status === "completed");
    } catch (err: any) {
      setError(err?.message || "Failed to fetch deck");
      onError?.(err);
    }
  }, [deckId, onError]);

  const reset = useCallback(() => {
    closeSocket();
    setDeckId(undefined);
    setDeck(undefined);
    setStatus(undefined);
    setProgress(undefined);
    setIsGenerating(false);
    setIsRevising(false);
    setIsConfirming(false);
    setIsEditing(false);
    setIsCancelling(false);
    setIsComplete(false);
    setError(null);
    reconnectAttemptsRef.current = 0;
  }, [closeSocket]);

  useEffect(() => {
    if (initialDeckId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      openSocket(initialDeckId);
    }
    return () => closeSocket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    deck,
    status,
    progress,
    isGenerating,
    isRevising,
    isConfirming,
    isEditing,
    isCancelling,
    isConnected,
    isScriptReady: status === "script_ready",
    isComplete,
    error,
    generate,
    revise,
    edit,
    confirm,
    cancel,
    fetchDeck,
    reset,
  };
}
