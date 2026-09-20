import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createMMKVStorage } from "./mmkv.storage";

const onboardingCompletionStorage = createMMKVStorage(
  "onboarding-completion-storage",
);

/**
 * Which Clerk user has completed the post-verification onboarding.
 *
 * Distinct from `onboarding.store.ts`'s `hasSeenOnboarding`, which tracks the
 * pre-auth welcome/features marketing flow. This one gates what happens *after*
 * a session exists: verify → onboarding → optional profile setup → app.
 *
 * Keyed by Clerk user id so each new account runs onboarding once, even when
 * several accounts share a device.
 */
interface OnboardingCompletionStore {
  completedForUserId: string | null;
  _hasHydrated: boolean;

  completeOnboarding: (userId: string) => void;
  resetOnboardingCompletion: () => void;
  setHasHydrated: (state: boolean) => void;
}

export const useOnboardingCompletionStore = create<OnboardingCompletionStore>()(
  persist(
    (set) => ({
      completedForUserId: null,
      _hasHydrated: false,

      completeOnboarding: (userId) => set({ completedForUserId: userId }),
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
