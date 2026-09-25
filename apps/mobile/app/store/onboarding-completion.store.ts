import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createMMKVStorage } from "./mmkv.storage";

const onboardingCompletionStorage = createMMKVStorage(
  "onboarding-completion-storage",
);

/**
 * Which Clerk user has completed the post-verification onboarding.
 *
 * This is the boundary the router reads between a signed-in account and the
 * app: onboarding (`(onboarding)`) → app. The
 * workflow's position within onboarding lives in
 * `onboarding-progress.store.ts`; this store only answers "finished or not".
 *
 * Keyed by Clerk user id so each new account runs onboarding once, even when
 * several accounts share a device.
 */
interface OnboardingCompletionStore {
  completedForUserId: string | null;
  /**
   * Which signed-in user the server has answered for this launch — or given
   * up on, after a timeout. Until then a user with no local completion is not
   * routed to onboarding: the account may well have finished it elsewhere.
   * In memory only; every launch asks again.
   */
  checkedForUserId: string | null;
  _hasHydrated: boolean;

  completeOnboarding: (userId: string) => void;
  markChecked: (userId: string) => void;
  resetOnboardingCompletion: () => void;
  setHasHydrated: (state: boolean) => void;
}

export const useOnboardingCompletionStore = create<OnboardingCompletionStore>()(
  persist(
    (set) => ({
      completedForUserId: null,
      checkedForUserId: null,
      _hasHydrated: false,

      completeOnboarding: (userId) => set({ completedForUserId: userId }),
      markChecked: (userId) => set({ checkedForUserId: userId }),
      resetOnboardingCompletion: () => set({ completedForUserId: null }),
      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: "onboarding-completion-store",
      storage: createJSONStorage(() => onboardingCompletionStorage),
      partialize: (state) => ({
        completedForUserId: state.completedForUserId,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error("Onboarding-completion store hydration failed:", error);
        } else {
          console.log("Onboarding-completion store hydrated:", state);
        }
      },
    },
  ),
);

useOnboardingCompletionStore.persist.onFinishHydration(() => {
  useOnboardingCompletionStore.getState().setHasHydrated(true);
});

if (useOnboardingCompletionStore.persist.hasHydrated()) {
  useOnboardingCompletionStore.getState().setHasHydrated(true);
}
