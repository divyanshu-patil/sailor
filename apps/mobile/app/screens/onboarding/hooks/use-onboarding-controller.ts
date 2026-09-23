import { useCallback, useEffect, useRef, useState } from "react";

import { onboardingService } from "@/services/onboarding.service";
import { userService } from "@/services/user.service";
import { useOnboardingCompletionStore } from "@/store/onboarding-completion.store";
import { useOnboardingPendingStore } from "@/store/onboarding-pending.store";
import {
  clearOnboardingProgress,
  readOnboardingProgress,
  useOnboardingProgressStore,
  writeOnboardingProgress,
} from "@/store/onboarding-progress.store";
import {
  createInitialOnboardingState,
  PENDING_SCOPE,
  type OnboardingData,
  type OnboardingState,
  type OnboardingStatus,
  type OnboardingStepId,
} from "@/types/onboarding";
import { normalizeNickname } from "@/utils/nickname";
import {
  FIRST_STEP_ID,
  ONBOARDING_STEPS,
  nextStepId,
  progressForStep,
  stepIndex,
} from "../config/steps";
import { reconcile } from "../lib/reconcile";

export interface OnboardingController {
  /** False until the local record has been read — do not render the flow yet. */
  hydrated: boolean;
  state: OnboardingState | null;
  currentStepId: OnboardingStepId | null;
  status: OnboardingStatus;
  /** 0–1, derived from the configured flow. */
  progress: number;
  /** An authoritative save is in flight (Continue is disabled meanwhile). */
  committing: boolean;
  reconciling: boolean;
  syncError: string | null;
  setDraftNickname: (value: string) => void;
  submitNickname: (display: string) => Promise<OnboardingStepId | null>;
  /** Records the gender answer and advances. Returns the next step, or null. */
  submitGender: (gender: string) => Promise<OnboardingStepId | null>;
  /** Records where the user heard about us and advances. */
  submitReferral: (referral: string) => Promise<OnboardingStepId | null>;
  /** Records the self-described speaking level and advances. */
  submitSpeakingLevel: (level: string) => Promise<OnboardingStepId | null>;
  /**
   * Marks `stepId` as the screen in view — used by the stack's focus effect so
   * going back updates the position too, not just going forward.
   */
  setCurrentStep: (stepId: OnboardingStepId) => void;
  goBack: () => void;
  retrySync: () => void;
}

/**
 * Moves a pre-auth onboarding record onto the account that just signed in.
 *
 * Called once per sign-in. Returns what happened so the caller knows whether to
 * keep reconciling. The nickname is claimed here — the authoritative moment —
 * because pre-auth the account did not exist to claim it against.
 */
async function handoffPendingOnboarding(
  userId: string,
): Promise<"none" | "continue" | "committed"> {
  const pending = readOnboardingProgress(PENDING_SCOPE);
  if (!pending) return "none";

  const clearPending = () => {
    clearOnboardingProgress(PENDING_SCOPE);
    useOnboardingPendingStore.getState().reset();
  };

  // The account already has a position; the device draft is stale. Drop it.
  if (readOnboardingProgress(userId)) {
    clearPending();
    return "none";
  }

  // An existing account that has already onboarded must not have the device's
  // pre-auth nickname claimed onto it — e.g. finishing onboarding, then tapping
  // "Log in" instead of creating the account. The account's answer wins.
  try {
    const profile = await userService.getProfile();
    if (profile.onboarding_completed) {
      clearPending();
      return "none";
    }
  } catch {
    // Offline: fall through. The claim below will fail too and route the user
    // to the nickname step, and the root gate reconciles once online.
  }

  const asUser: OnboardingState = {
    ...pending,
    userId,
    lastUpdatedAt: new Date().toISOString(),
  };

  // Signed up mid-flow: carry the position over and let the post-auth flow
  // continue from where it was.
  if (pending.status !== "completed") {
    writeOnboardingProgress(asUser, true);
    clearPending();
    return "continue";
  }

  const nickname =
    typeof pending.data.nickname === "string" ? pending.data.nickname : "";

  if (nickname) {
    try {
      await onboardingService.claimNickname(nickname);
    } catch {
      // Taken (409) or the network failed. Either way the name is not safely
      // on the account, so reopen the nickname step — prefilled with the other
      // answers — and let the user confirm or change it. Continue retries the
      // authoritative claim.
      writeOnboardingProgress(
        {
          ...asUser,
          status: "in_progress",
          currentStepId: "profile_identity",
          completedSteps: asUser.completedSteps.filter(
            (id) => id !== "profile_identity",
          ),
          completedAt: null,
        },
        true,
      );
      clearPending();
      return "continue";
    }
  }

  writeOnboardingProgress(asUser, true);
  clearPending();
  // Durable copy + the one-way flag the router reads.
  void onboardingService.saveProgress(asUser).catch(() => {});
  useOnboardingCompletionStore.getState().completeOnboarding(userId);
  return "committed";
}

/**
 * Owns the onboarding position: hydrates it, reconciles it with the server,
 * advances it, and syncs it. Runs in two modes:
 *
 *  - `authenticated: false` — pre-auth. Local only; the nickname is checked
 *    against the public availability endpoint but not claimed (no account yet).
 *  - `authenticated: true` — the account exists. Claims the nickname, syncs
 *    progress, and absorbs any pre-auth record left behind on this device.
 *
 * It never touches React navigation; the route maps the position onto a screen.
 */
export function useOnboardingController(
  scope: string,
  authenticated: boolean,
): OnboardingController {
  const userId = authenticated ? scope : null;
  const hydrated = useOnboardingProgressStore((s) => s.hydrated);
  const state = useOnboardingProgressStore((s) => s.state);
  const [reconciling, setReconciling] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Local first: synchronous, so the right step renders before any request.
  useEffect(() => {
    if (!scope) return;
    useOnboardingProgressStore.getState().hydrate(scope);
    // Pre-auth has no server round trip to seed the first position, so create
    // it here. The authenticated path seeds via reconciliation instead.
    if (!authenticated && !useOnboardingProgressStore.getState().state) {
      useOnboardingProgressStore
        .getState()
        .setState(createInitialOnboardingState(PENDING_SCOPE, FIRST_STEP_ID), {
          sync: false,
        });
    }
  }, [scope, authenticated]);

  const flushSync = useCallback(async () => {
    if (!authenticated) return;
    const snapshot = useOnboardingProgressStore.getState().state;
    if (!snapshot) return;
    try {
      const saved = await onboardingService.saveProgress(snapshot);
      const store = useOnboardingProgressStore.getState();
      if (store.state?.lastUpdatedAt === snapshot.lastUpdatedAt) {
        store.adoptRemote(saved);
      } else {
        store.markSynced();
      }
      setSyncError(null);
    } catch {
      setSyncError("Couldn't sync your progress. We'll try again.");
    }
  }, [authenticated]);

  const reconciledFor = useRef<string | null>(null);
  useEffect(() => {
    if (!authenticated || !userId || !hydrated) return;
    if (reconciledFor.current === userId) return;
    reconciledFor.current = userId;

    let cancelled = false;
    const controller = new AbortController();
    setReconciling(true);

    (async () => {
      const outcome = await handoffPendingOnboarding(userId);
      if (cancelled) return;
      // Re-read from disk: a hand-off may have just written the user's record.
      useOnboardingProgressStore.getState().hydrate(userId);
      if (outcome === "committed") {
        setReconciling(false);
        return;
      }

      let remote: OnboardingState | null = null;
      try {
        remote = await onboardingService.getProgress(userId, controller.signal);
      } catch {
        // Offline: the local record stands, which is the whole point of it.
        remote = null;
      }
      if (cancelled) return;

      const store = useOnboardingProgressStore.getState();
      const result = reconcile(store.state, remote);
      if (result.action === "start_fresh") {
        store.setState(createInitialOnboardingState(userId, FIRST_STEP_ID), {
          sync: true,
        });
      } else if (result.action === "use_server" && remote) {
        store.adoptRemote(remote);
      }

      const needsSync =
        result.action === "start_fresh" ||
        (result.action === "use_local" && result.needsServerSync);

      if (cancelled) return;
      setReconciling(false);
      if (needsSync) void flushSync();
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [authenticated, userId, hydrated, flushSync]);

  const setDraftNickname = useCallback((value: string) => {
    useOnboardingProgressStore.getState().patchData({ nickname: value });
  }, []);

  /**
   * Marks `stepId` done, stores its answers, and moves the position on.
   *
   * Shared by every step: the step-specific work (claiming a nickname, say)
   * happens before this, and the completion hand-off happens here so a new
   * step cannot forget it. Returns the next step id, or `null` on finish.
   */
  const commitStep = useCallback(
    async (
      stepId: OnboardingStepId,
      data: Partial<OnboardingData>,
    ): Promise<OnboardingStepId | null> => {
      const store = useOnboardingProgressStore.getState();
      const current = store.state;
      if (!current) throw new Error("Onboarding is not ready yet.");

      const next = nextStepId(stepId);
      const completedSteps = current.completedSteps.includes(stepId)
        ? current.completedSteps
        : [...current.completedSteps, stepId];

      const updated: OnboardingState = {
        ...current,
        data: { ...current.data, ...data },
        completedSteps,
        currentStepId: next,
        status: next ? "in_progress" : "completed",
        completedAt: next ? null : new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
      };
      // Pre-auth records are local until the hand-off; there is no server
      // position to sync yet.
      store.setState(updated, { sync: authenticated });

      if (!next) {
        if (authenticated) {
          useOnboardingCompletionStore
            .getState()
            .completeOnboarding(current.userId);
          void onboardingService.markOnboardingComplete().catch(() => {});
          void flushSync();
        } else {
          useOnboardingPendingStore.getState().markCompleted();
          useOnboardingPendingStore.getState().requestCreateAccount();
        }
      } else if (authenticated) {
        void flushSync();
      }

      return next;
    },
    [authenticated, flushSync],
  );

  const submitNickname = useCallback(
    async (display: string): Promise<OnboardingStepId | null> => {
      if (!useOnboardingProgressStore.getState().state) {
        throw new Error("Onboarding is not ready yet.");
      }
      setCommitting(true);
      try {
        // Authoritative first, when there is an account to claim against. If it
        // throws (409/network) nothing local is advanced, so the user stays on
        // this step with their input intact.
        if (authenticated) {
          await onboardingService.claimNickname(display);
        }
        return await commitStep("profile_identity", {
          nickname: display,
          nicknameNormalized: normalizeNickname(display),
        });
      } finally {
        setCommitting(false);
      }
    },
    [authenticated, commitStep],
  );

  const submitGender = useCallback(
    (gender: string) => commitStep("gender", { gender }),
    [commitStep],
  );

  const submitReferral = useCallback(
    (referral: string) => commitStep("referral", { referral }),
    [commitStep],
  );

  const submitSpeakingLevel = useCallback(
    (level: string) => commitStep("speaking_level", { speakingLevel: level }),
    [commitStep],
  );

  const setCurrentStep = useCallback(
    (stepId: OnboardingStepId) => {
      const store = useOnboardingProgressStore.getState();
      const current = store.state;
      // No-op when already there: the focus effect runs on every render while
      // focused, and a completed flow backing up onto a step re-opens it.
      if (!current || current.currentStepId === stepId) return;
      store.patch(
        { currentStepId: stepId, status: "in_progress", completedAt: null },
        { sync: authenticated },
      );
      if (authenticated) void flushSync();
    },
    [authenticated, flushSync],
  );

  const goBack = useCallback(() => {
    const store = useOnboardingProgressStore.getState();
    const current = store.state;
    if (!current || !current.currentStepId) return;
    const index = stepIndex(current.currentStepId);
    if (index <= 0) return;
    store.patch(
      { currentStepId: ONBOARDING_STEPS[index - 1].id },
      { sync: authenticated },
    );
    if (authenticated) void flushSync();
  }, [authenticated, flushSync]);

  return {
    hydrated,
    state,
    currentStepId: state?.currentStepId ?? null,
    status: state?.status ?? "not_started",
    // A completed pre-auth flow renders the first step (see `index.tsx`), so
    // the bar shows step one rather than a finished flow. Post-auth completed
    // is never rendered.
    progress: progressForStep(state?.currentStepId ?? FIRST_STEP_ID),
    committing,
    reconciling,
    syncError,
    setDraftNickname,
    submitNickname,
    submitGender,
    submitReferral,
    submitSpeakingLevel,
    setCurrentStep,
    goBack,
    retrySync: () => void flushSync(),
  };
}
