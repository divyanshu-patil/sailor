import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import { createMMKVStorage } from "./mmkv.storage";

const pendingStorage = createMMKVStorage("onboarding-pending-storage");

/**
 * Whether the pre-auth onboarding flow has been finished on this device.
 *
 * The flow runs before an account exists, so there is no user id to key a
 * completion by yet — this is the device's answer to "should Get started open
 * onboarding or the create-account step?". The answers themselves live in the
 * progress store under `PENDING_SCOPE`; this is only the routing flag.
 *
 * Cleared once the record is handed off to the account on sign-in.
 */
interface OnboardingPendingStore {
  completed: boolean;
  /**
   * Set when onboarding finishes so the base screen morphs into create-account.
   * Transient and deliberately not persisted: it is a one-shot hand-off, not a
   * state the next launch should replay.
   */
  createAccountRequested: boolean;
  _hasHydrated: boolean;

  markCompleted: () => void;
  requestCreateAccount: () => void;
  consumeCreateAccountRequest: () => void;
  reset: () => void;
  setHasHydrated: (state: boolean) => void;
}

export const useOnboardingPendingStore = create<OnboardingPendingStore>()(
  persist(
    (set) => ({
      completed: false,
      createAccountRequested: false,
      _hasHydrated: false,

      markCompleted: () => set({ completed: true }),
      requestCreateAccount: () => set({ createAccountRequested: true }),
      consumeCreateAccountRequest: () => set({ createAccountRequested: false }),
      reset: () => set({ completed: false, createAccountRequested: false }),
      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: "onboarding-pending-store",
      storage: createJSONStorage(() => pendingStorage),
      partialize: (state) => ({ completed: state.completed }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error("Onboarding-pending store hydration failed:", error);
        }
      },
    },
  ),
);

useOnboardingPendingStore.persist.onFinishHydration(() => {
  useOnboardingPendingStore.getState().setHasHydrated(true);
});

if (useOnboardingPendingStore.persist.hasHydrated()) {
  useOnboardingPendingStore.getState().setHasHydrated(true);
}
