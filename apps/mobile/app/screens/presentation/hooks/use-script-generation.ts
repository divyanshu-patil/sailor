import { useCallback, useEffect, useRef, useState } from "react";
import { useJobPoller } from "./use-job-poller";
import {
  GenerateScriptPayload,
  ScriptGeneration,
  ScriptVersion,
  scriptService,
} from "@/services/script.service";
import {
  registerActiveGeneration,
  releaseActiveGeneration,
} from "@/lib/generation-guard";
import { apiErrorMessage } from "@/lib/api/client";
import {
  upsertDraft,
  replaceVersions,
  listVersions as dbListVersions,
} from "@/db/generations.repo";

export type { JobState as GenerationState } from "./use-job-poller";

/** What the poller carries for a script job. The status endpoint returns the
 *  finished script inline, so a completed poll needs no follow-up request. */
export interface ScriptResult {
  id: string;
  title: string;
  script: string;
}

/**
 * Phase one: generate a script.
 *
 * No deck is created here. The generation is its own resource, and the deck only
 * comes into existence when the user accepts the script — see useDeckGeneration
 * below. Three behaviours are new and load-bearing:
 *
 *  - `startGeneration` resumes rather than restarts. An unchanged brief resolves
 *    server-side to the generation that's already running or already finished,
 *    so stepping back to the wizard and pressing Generate again costs nothing
 *    and discards nothing.
 *  - leaving the screen doesn't stop anything. Cancellation is owned by
 *    lib/generation-guard, which fires on home navigation and backgrounding.
 *  - every finished run, revision and edit appends a version, and `undo`/`redo`
 *    step through them.
 */
export function useScriptGeneration() {
  // Destructured rather than held as one `poller` object on purpose. The object
  // is a fresh literal on every render, so a callback with `[poller]` in its
  // deps changes identity every render — and any consumer effect keyed on that
  // callback then re-fires every render. Each of these members is individually
  // stable (`useCallback([])` inside the poller), so the wrappers below are too.
  const {
    state,
    result,
    error,
    jobIdRef,
    // `start` is unused: the kickoff call and the poll attach are separate here,
    // because POST /scripts may hand back a generation that's already finished
    // and there'd be nothing to poll for.
    attach,
    stop,
    retry,
    setResult: setPollerResult,
  } = useJobPoller<ScriptResult>({
    getStatus: async (id) => {
      const res = await scriptService.getJobStatus(id);
      // A completed status that still carries an error is a revision that
      // failed and was rolled back: the user's previous script is intact and
      // comes back with it. That has to read as "your change didn't apply", not
      // as a dead job — so it's routed to the mutation error and the script is
      // published as normal.
      if (res.status === "completed" && res.error) {
        setMutationError(res.error);
      }
      return {
        status: res.status,
        error: res.error,
        result:
          res.script != null
            ? { id, title: res.title ?? "", script: res.script }
            : undefined,
      };
    },
    getResult: async (id) => {
      const generation = await scriptService.get(id);
      return {
        id: generation.id,
        title: generation.title,
        script: generation.script,
      };
    },
    // Deliberately omitted. `stop()` here only ends the client's polling; the
    // server-side cancel is the guard's job, and wiring it in as the poller's
    // cancelJob would resurrect exactly the "back gesture kills the script"
    // behaviour this migration removed.
  });

  const [isRevising, setIsRevising] = useState(false);
  /** Why a revise/edit request itself was rejected — a 409 because a job is
   *  already running, a 400 because there's no script yet. Distinct from the
   *  poller's `error`, which is about the job, not the request. */
  const [mutationError, setMutationError] = useState<string | null>(null);

  // Mirrors the poller's `jobIdRef` into state. Consumers render off this — the
  // Create button, the edit modal's route param — and a ref read during render
  // doesn't schedule the re-render that would reveal it had been set.
  const [generationId, setGenerationId] = useState<string | null>(null);

  // ---- version history / undo-redo ---------------------------------------
  const [versions, setVersions] = useState<ScriptVersion[]>([]);
  // Index into `versions`. -1 while there's no history yet. Held in state, not
  // derived from the current script, because two versions can legitimately have
  // identical text and the cursor still has to know which one it's on.
  const [versionIndex, setVersionIndex] = useState(-1);

  /** Mirror a generation into SQLite so the drafts list and a cold start can
   *  read it without a round trip. Fire-and-forget: a failed local write must
   *  never fail the user's action. */
  const mirror = useCallback((generation: ScriptGeneration) => {
    void upsertDraft({
      id: generation.id,
      description: generation.description,
      durationMins: generation.durationMinutes,
      cardCount: generation.cardCount,
      audience: generation.audience,
      title: generation.title,
      script: generation.script || null,
      status: generation.status,
      error: generation.error,
      deckId: generation.deckId,
      versionCount: generation.versionCount,
      createdAt: generation.createdAt,
      updatedAt: generation.updatedAt,
    }).catch(() => {});
  }, []);

  /**
   * Load the version history, from disk first.
   *
   * The history is append-only and mirrored locally, so the stored copy is
   * always a correct prefix of the server's — never wrong, only possibly short.
   * That makes disk the right thing to render from and the network a background
   * top-up, rather than a fetch the user waits on. Undo used to refetch the
   * whole list on every tap, which is a round trip per press for data that
   * cannot have changed.
   */
  const loadVersions = useCallback(
    async (id: string, { resync = true }: { resync?: boolean } = {}) => {
      let local: ScriptVersion[] = [];
      try {
        local = (await dbListVersions(id)).map((v) => ({
          id: v.id,
          position: v.position,
          title: v.title,
          script: v.script,
          kind: v.kind,
          instruction: v.instruction,
          createdAt: v.createdAt,
        }));
        if (local.length) {
          setVersions(local);
          setVersionIndex((current) =>
            current < 0 ? local.length - 1 : Math.min(current, local.length - 1),
          );
        }
      } catch {
        // Disk miss just means the network path below has to fill it in.
      }

      if (!resync) return local;

      try {
        const remote = await scriptService.listVersions(id);
        // Only touch state if the server actually knows something new. Writing
        // an identical list back would move the cursor to the tip and silently
        // undo a step the user just took.
        if (remote.length !== local.length) {
          setVersions(remote);
          setVersionIndex(remote.length - 1);
        }
        void replaceVersions(
          id,
          remote.map((v) => ({ ...v, generationId: id })),
        ).catch(() => {});
        return remote;
      } catch {
        // History is an enhancement — failing to refresh it must not take the
        // script down with it. Whatever is on disk stays usable.
        return local;
      }
    },
    [],
  );

  /**
   * Start generating, or pick up the generation this brief already has.
   *
   * Returns the generation id either way, so a caller doesn't need to care which
   * happened — except when it does, which is what `reused` is for.
   */
  const startGeneration = useCallback(
    async (payload: GenerateScriptPayload) => {
      setMutationError(null);
      try {
        const { generation, reused } = await scriptService.generate(payload);
        mirror(generation);
        setGenerationId(generation.id);
        registerActiveGeneration(generation.id);

        if (reused && generation.status === "completed" && generation.script) {
          // Already finished. Publishing the result directly rather than
          // attaching keeps the screen from flashing its generating state for a
          // script that's been sitting on the server the whole time.
          jobIdRef.current = generation.id;
          setPollerResult({
            id: generation.id,
            title: generation.title,
            script: generation.script,
          });
          releaseActiveGeneration(generation.id);
          void loadVersions(generation.id);
          return { id: generation.id, reused, alreadyComplete: true };
        }

        attach(generation.id);
        return { id: generation.id, reused, alreadyComplete: false };
      } catch (e: any) {
        setMutationError(apiErrorMessage(e, "Couldn't start generation"));
        throw e;
      }
    },
    [attach, jobIdRef, mirror, loadVersions, setPollerResult],
  );

  /** Resume polling a generation the caller already knows the id of. */
  const resumeGeneration = useCallback(
    (id: string) => {
      setGenerationId(id);
      registerActiveGeneration(id);
      attach(id);
      void loadVersions(id);
    },
    [attach, loadVersions],
  );

  /** Explicit Stop. The only place in the flow that cancels on the user's
   *  direct instruction. */
  const stopGeneration = useCallback(async () => {
    const id = jobIdRef.current;
    stop();
    releaseActiveGeneration(id ?? undefined);
    if (id) {
      try {
        await scriptService.cancel(id);
      } catch {
        // Best effort — the generation's own status is authoritative next time
        // the user opens it.
      }
    }
  }, [jobIdRef, stop]);

  /** "Try again" after a failed or cancelled run. Re-queues the original brief
   *  on the same generation, so no dead draft is left behind. */
  const retryGeneration = useCallback(async () => {
    const id = jobIdRef.current;
    if (id) registerActiveGeneration(id);
    return retry(async (jobId) => {
      await scriptService.retry(jobId);
      return { job_id: jobId };
    });
  }, [jobIdRef, retry]);

  /**
   * AI revision — a job on the same generation, so the revised script arrives
   * through the poller exactly like the first generation did.
   */
  const revise = useCallback(
    async (instruction: string): Promise<boolean> => {
      const id = jobIdRef.current;
      if (!id) {
        setMutationError("No script to revise yet.");
        return false;
      }

      setIsRevising(true);
      setMutationError(null);
      try {
        const generation = await scriptService.revise(id, instruction);
        mirror(generation);
        registerActiveGeneration(id);
        attach(id);
        return true;
      } catch (e: any) {
        // The API's `detail` is the only thing that says *why* — a 409 for a job
        // already in flight reads very differently to a 400 for a missing
        // script, and swallowing both left the user with a bare "failed".
        setMutationError(apiErrorMessage(e, "Couldn't start the revision"));
        return false;
      } finally {
        setIsRevising(false);
      }
    },
    [attach, jobIdRef, mirror],
  );

  /**
   * Manual edit — a plain PATCH, so the new script comes straight back.
   *
   * Takes the generation id explicitly because the edit screen is mounted on its
   * own (as a modal), where this hook's `jobIdRef` was never populated by a
   * `start`.
   */
  const edit = useCallback(
    async (
      script: string,
      generationId?: string,
    ): Promise<ScriptResult | undefined> => {
      const id = generationId ?? jobIdRef.current;
      if (!id) return undefined;

      setIsRevising(true);
      setMutationError(null);
      try {
        const generation = await scriptService.edit(id, script);
        mirror(generation);
        const next = {
          id: generation.id,
          title: generation.title,
          script: generation.script,
        };
        setPollerResult(next);
        void loadVersions(id);
        return next;
      } catch (e: any) {
        setMutationError(apiErrorMessage(e, "Couldn't save the script"));
        return undefined;
      } finally {
        setIsRevising(false);
      }
    },
    [jobIdRef, mirror, loadVersions, setPollerResult],
  );

  /**
   * Step the history cursor and make that version current.
   *
   * The script is swapped locally and immediately — every version's full text is
   * already on disk, so there is nothing to fetch and no reason for an undo to
   * feel like a network operation. The server is told afterwards, in the
   * background, purely so the change survives a reinstall or another device.
   *
   * Restoring never appends a version, or stepping back and forth would grow the
   * stack on every tap and undo would stop being reversible.
   */
  const goToVersion = useCallback(
    (index: number) => {
      const id = jobIdRef.current;
      const target = versions[index];
      if (!id || !target) return;

      setVersionIndex(index);
      setPollerResult({
        id,
        title: target.title,
        script: target.script,
      });
      void upsertDraft({
        id,
        title: target.title,
        script: target.script,
      }).catch(() => {});

      // Fire-and-forget. A failed sync doesn't roll the UI back: the version is
      // still in local history either way, and reverting the script under the
      // user because a background request failed is worse than being briefly out
      // of step with the server.
      scriptService.restoreVersion(id, target.id).catch(() => {
        console.log("[script] version restore failed to sync", id, target.id);
      });
    },
    [jobIdRef, setPollerResult, versions],
  );

  const canUndo = versionIndex > 0;
  const canRedo = versionIndex >= 0 && versionIndex < versions.length - 1;

  const undo = useCallback(() => {
    if (canUndo) void goToVersion(versionIndex - 1);
  }, [canUndo, goToVersion, versionIndex]);

  const redo = useCallback(() => {
    if (canRedo) void goToVersion(versionIndex + 1);
  }, [canRedo, goToVersion, versionIndex]);

  // A terminal state means there is no longer anything to cancel — releasing
  // here is what stops a later backgrounding from firing a pointless cancel at
  // a finished job.
  useEffect(() => {
    if (state === "completed" || state === "failed" || state === "cancelled") {
      releaseActiveGeneration(jobIdRef.current ?? undefined);
    }
  }, [state, jobIdRef]);

  // Reload the history whenever a run finishes: that's when a new version
  // exists, and it's the only moment the arrows need to change.
  const lastLoadedRef = useRef<string | null>(null);
  useEffect(() => {
    const id = jobIdRef.current;
    if (state !== "completed" || !id || !result) return;
    const stamp = `${id}:${result.script.length}:${result.title}`;
    if (lastLoadedRef.current === stamp) return;
    lastLoadedRef.current = stamp;
    void loadVersions(id);
  }, [state, result, jobIdRef, loadVersions]);

  return {
    state,
    result,
    // The job's own failure reason takes precedence; a rejected request is the
    // fallback, since it never reaches the poller at all.
    error: error ?? mutationError,
    generationId,
    startGeneration,
    resumeGeneration,
    stopGeneration,
    retryGeneration,
    revise,
    edit,
    isRevising,
    // history
    versions,
    versionIndex,
    canUndo,
    canRedo,
    undo,
    redo,
  };
}

/**
 * Phase two: turn an accepted script into a deck.
 *
 * The job is polled against the *generation*, not a deck, because there is no
 * deck to poll — cards are generated first and the deck is written together with
 * them at the very end. That's what stops an empty deck appearing in the grid
 * the instant Create is tapped. `result.deckId` is null for the whole job and
 * non-null exactly once the deck exists and is complete.
 */
export function useDeckGeneration() {
  // Destructured for the same reason as useScriptGeneration above.
  const { state, result, error, start, attach, stop, jobIdRef } = useJobPoller<{
    deckId: string;
  }>({
    getStatus: async (generationId) => {
      const res = await scriptService.getDeckBuildStatus(generationId);
      return {
        status: res.status,
        error: res.error,
        result: res.deckId ? { deckId: res.deckId } : undefined,
      };
    },
    getResult: async (generationId) => {
      const res = await scriptService.getDeckBuildStatus(generationId);
      if (!res.deckId) throw new Error("Deck isn't ready yet");
      return { deckId: res.deckId };
    },
    cancelJob: scriptService.cancelDeckBuild,
  });

  /** Accept the script and start building. Goes through the poller's `start`,
   *  so the screen reads "generating" before the kickoff request returns and a
   *  failed kickoff lands as a retryable failure. The deck id arrives later,
   *  through `result`. */
  const createDeck = useCallback(
    (generationId: string) => {
      // Set up front so Try again has an id even if the kickoff itself fails.
      jobIdRef.current = generationId;
      return start(async () => {
        await scriptService.startDeckBuild(generationId);
        // The script has been accepted; the script job itself is long finished,
        // so there's nothing left for the guard to cancel.
        releaseActiveGeneration(generationId);
        return { job_id: generationId };
      });
    },
    [start, jobIdRef],
  );

  const resumeDeckGeneration = useCallback(
    (generationId: string) => attach(generationId),
    [attach],
  );

  /** Re-run a card job that failed or was stopped. The API re-queues on the same
   *  generation, so nothing was orphaned by the previous attempt. */
  const retryDeckGeneration = useCallback(async () => {
    const id = jobIdRef.current;
    if (!id) return;
    await scriptService.startDeckBuild(id);
    attach(id);
  }, [attach, jobIdRef]);

  const stopDeckGeneration = useCallback(async () => {
    const id = jobIdRef.current;
    stop();
    if (id) {
      try {
        await scriptService.cancelDeckBuild(id);
      } catch {
        // Best effort — nothing was written, so a failed cancel costs provider
        // time at worst, never a half-built deck.
      }
    }
  }, [jobIdRef, stop]);

  return {
    state,
    /** Non-null only once the deck exists with its cards. */
    deckId: result?.deckId ?? null,
    error,
    createDeck,
    resumeDeckGeneration,
    retryDeckGeneration,
    stopDeckGeneration,
  };
}
