import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createMMKVStorage } from "./mmkv.storage";

const profileSetupStorage = createMMKVStorage("profile-setup-storage");

/**
 * Which Clerk user finished the optional profile setup wizard (by uploading a
 * photo or skipping).
 *
 * Keyed by Clerk user id rather than a bare boolean: completion is a fact about
 * an *account*, not a device, so a different account signing in on the same
 * phone still gets the wizard. It deliberately survives sign-out for the same
 * reason — the account that answered it never sees it twice.
 */
interface ProfileSetupStore {
  completedForUserId: string | null;
  _hasHydrated: boolean;

  completeProfileSetup: (userId: string) => void;
  resetProfileSetup: () => void;
  setHasHydrated: (state: boolean) => void;
}

export const useProfileSetupStore = create<ProfileSetupStore>()(
  persist(
    (set) => ({
      completedForUserId: null,
      _hasHydrated: false,

      completeProfileSetup: (userId) => set({ completedForUserId: userId }),
      resetProfileSetup: () => set({ completedForUserId: null }),
      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: "profile-setup-store",
      storage: createJSONStorage(() => profileSetupStorage),
      partialize: (state) => ({
        completedForUserId: state.completedForUserId,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error("Profile-setup store hydration failed:", error);
        } else {
          console.log("Profile-setup store hydrated:", state);
        }
      },
    },
  ),
);

useProfileSetupStore.persist.onFinishHydration(() => {
  useProfileSetupStore.getState().setHasHydrated(true);
});

if (useProfileSetupStore.persist.hasHydrated()) {
  useProfileSetupStore.getState().setHasHydrated(true);
}
