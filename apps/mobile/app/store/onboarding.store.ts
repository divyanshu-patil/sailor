import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createMMKVStorage } from "./mmkv.storage";

const onboardingStorage = createMMKVStorage("onboarding-storage");

// hasSeenOnboarding is persisted so onboarding doesn't replay on every app
// restart. Deliberately separate from the app-user store — onboarding
// state has nothing to do with who's signed in, and shouldn't get wiped
// just because clearAppState() runs on sign-out.
interface OnboardingStore {
  hasSeenOnboarding: boolean;
  _hasHydrated: boolean;

  completeOnboarding: (shouldComplete: boolean) => void;
  resetOnboarding: () => void;
  setHasHydrated: (state: boolean) => void;
}

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set) => ({
      hasSeenOnboarding: false,
      _hasHydrated: false,

      completeOnboarding: (shouldComplete) => {
        set({ hasSeenOnboarding: shouldComplete });
      },

      resetOnboarding: () => {
        set({ hasSeenOnboarding: false });
      },

      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: "onboarding-store",
      storage: createJSONStorage(() => onboardingStorage),
      partialize: (state) => ({
        hasSeenOnboarding: state.hasSeenOnboarding,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error("Onboarding store hydration failed:", error);
        } else {
          console.log("Onboarding store hydrated:", state);
        }
      },
    },
  ),
);

useOnboardingStore.persist.onFinishHydration(() => {
  useOnboardingStore.getState().setHasHydrated(true);
});

if (useOnboardingStore.persist.hasHydrated()) {
  useOnboardingStore.getState().setHasHydrated(true);
}
