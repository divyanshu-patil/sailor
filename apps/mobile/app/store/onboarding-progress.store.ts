import { create } from "zustand";

import { createMMKVStorage } from "./mmkv.storage";
import type { OnboardingData, OnboardingState } from "@/types/onboarding";

/**
 * Local persistence for the onboarding workflow, keyed by the authenticated
 * user.
 *
 * Not a `zustand/persist` store: persist keeps one blob under one key, which
 * cannot express "one record per account". Here each user gets their own key
 * (`onboarding:<userId>`), so user A's nickname and step can never be read back
 * for user B when accounts change on a shared device.
 *
 * The store is a thin in-memory mirror of MMKV. Network orchestration lives in
 * the controller (`use-onboarding-controller`), not here.
 */
const storage = createMMKVStorage("onboarding-progress-storage");

const keyFor = (userId: string) => `onboarding:${userId}`;

interface PersistedRecord {
  state: OnboardingState;
  pendingSync: boolean;
}

function readRecord(userId: string): PersistedRecord | null {
  const raw = storage.getItem(keyFor(userId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PersistedRecord;
    if (!parsed?.state?.userId) return null;
    return parsed;
  } catch (e) {
    console.error("onboarding-progress read failed", e);
    return null;
  }
}

function writeRecord(record: PersistedRecord): void {
  storage.setItem(keyFor(record.state.userId), JSON.stringify(record));
}

interface OnboardingProgressStore {
  /** False until `hydrate` has run for a user. Gates rendering the flow. */
  hydrated: boolean;
  userId: string | null;
  state: OnboardingState | null;
  /** The server's copy is behind — retry the PUT at the next opportunity. */
  pendingSync: boolean;

  hydrate: (userId: string) => void;
  /** Replace the whole position (initial creation, or a step transition). */
  setState: (state: OnboardingState, opts?: { sync?: boolean }) => void;
  /** Merge fields/data into the current position. */
  patch: (
    patch: Partial<OnboardingState>,
    opts?: { sync?: boolean },
  ) => void;
  /** Persist uncommitted form data locally without asking the server yet. */
  patchData: (data: Partial<OnboardingData>) => void;
  /** Adopt a position the server already holds. */
  adoptRemote: (state: OnboardingState) => void;
  markSynced: () => void;
  /** Drop this user's record (dev reset, or a completed flow). */
  clear: (userId?: string) => void;
  /** Drop every user's record — the dev "clear app storage" path. */
  clearAll: () => void;
}

export const useOnboardingProgressStore = create<OnboardingProgressStore>(
  (set, get) => ({
    hydrated: false,
    userId: null,
    state: null,
    pendingSync: false,

    hydrate: (userId) => {
      const record = readRecord(userId);
      set({
        hydrated: true,
        userId,
        state: record?.state ?? null,
        pendingSync: record?.pendingSync ?? false,
      });
    },

    setState: (state, opts) => {
      const sync = opts?.sync ?? true;
      writeRecord({ state, pendingSync: sync });
      set({ state, pendingSync: sync, userId: state.userId, hydrated: true });
    },

    patch: (patch, opts) => {
      const current = get().state;
      if (!current) return;
      const next: OnboardingState = {
        ...current,
        ...patch,
        lastUpdatedAt: new Date().toISOString(),
      };
      const sync = opts?.sync ?? true;
      writeRecord({ state: next, pendingSync: sync || get().pendingSync });
      set({ state: next, pendingSync: sync || get().pendingSync });
    },

    patchData: (data) => {
      const current = get().state;
      if (!current) return;
      // Local only — the server sees answers when the step is committed, never
      // on a keystroke. The previous pendingSync is preserved rather than
      // forced, so a draft edit does not fake a committed change.
      const next: OnboardingState = {
        ...current,
        data: { ...current.data, ...data },
      };
      writeRecord({ state: next, pendingSync: get().pendingSync });
      set({ state: next });
    },

    adoptRemote: (state) => {
      writeRecord({ state, pendingSync: false });
      set({ state, pendingSync: false, userId: state.userId });
    },

    markSynced: () => {
      const current = get().state;
      if (!current) return;
      writeRecord({ state: current, pendingSync: false });
      set({ pendingSync: false });
    },

    clear: (userId) => {
      const target = userId ?? get().userId;
      if (target) storage.removeItem(keyFor(target));
      set({ state: null, pendingSync: false, hydrated: false, userId: null });
    },

    clearAll: () => {
      storage.clearAll();
      set({ state: null, pendingSync: false, hydrated: false, userId: null });
    },
  }),
);

/** Read a user's (or the pending) persisted position without touching React state. */
export function readOnboardingProgress(
  scope: string,
): OnboardingState | null {
  return readRecord(scope)?.state ?? null;
}

/** Write a position straight to disk, bypassing the in-memory mirror. Used by
 *  the sign-in hand-off, which moves a record between scopes. */
export function writeOnboardingProgress(
  state: OnboardingState,
  pendingSync = true,
): void {
  writeRecord({ state, pendingSync });
}

/** Remove one scope's record (hand-off source, or a dev reset). */
export function clearOnboardingProgress(scope: string): void {
  storage.removeItem(keyFor(scope));
}
