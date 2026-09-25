import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createMMKVStorage } from "./mmkv.storage";
import { userService } from "@/services/user.service";
import { ExperienceLevel, Profession } from "@/types/user";

const appUserStorage = createMMKVStorage("app-user-storage");

// profile shape (data from supabase `users` table).
// Clerk has actual identity (email, password)
// app-specific that lives in YOUR database, keyed by Clerk's user id.
export interface AppUserProfile {
  id: string; // DB primary key
  clerkUserId: string; // Clerk's `sub` claim
  email: string;
  nickname: string;
  experienceLevel: ExperienceLevel;
  profession: Profession | null;
  avatarUrl: string | null;
  role: "user" | "admin" | "dev";
  // ...add as needed from database.
}

// Fields the edit-profile screen (or anything else) can update. Kept
// separate from AppUserProfile since not every field is editable (id,
// clerkUserId, role aren't sent up here).
export interface ProfileUpdateInput {
  nickname?: string;
  experienceLevel?: ExperienceLevel;
  profession?: Profession | null;
  email?: string;
}

interface AppUserStore {
  _hasHydrated: boolean;
  appUser: AppUserProfile | null;

  // TODO(offline-sync): once real offline sync is built, failed updates in
  // updateAppUserProfile below should land in a persisted queue here
  // (e.g. `pendingProfileUpdates: ProfileUpdateInput[]`) and get retried on
  // reconnect / app foreground, instead of just being logged and left as-is.

  setHasHydrated: (state: boolean) => void;
  setAppUser: (user: AppUserProfile | null) => void;
  updateAppUserProfile: (input: ProfileUpdateInput) => Promise<void>;
  clearAppState: () => void; // call this on sign-out
}

export const useAppUserStore = create<AppUserStore>()(
  persist(
    (set, get) => ({
      _hasHydrated: false,
      appUser: null,

      setAppUser: (appUser) => set({ appUser }),

      // Local-first update: this is NOT an optimistic-update-with-rollback.
      // 1. Write to the store (and therefore MMKV) immediately, so the UI
      //    and every screen reading from the store see the change right away,
      //    online or not.
      // 2. Fire the API call in the background to sync it up.
      // 3. On success, reconcile with whatever the server actually saved.
      // 4. On failure, the local value is left exactly as the user set it —
      //    there's nothing to roll back to. It just hasn't synced yet.
      updateAppUserProfile: async (input) => {
        const current = get().appUser;
        if (!current) return;

        const localNext: AppUserProfile = { ...current, ...input };
        set({ appUser: localNext });

        try {
          const payload: Parameters<typeof userService.updateProfile>[0] = {};
          if (input.nickname !== undefined) payload.nickname = input.nickname;
          if (input.experienceLevel !== undefined)
            payload.experience_level = input.experienceLevel;
          if (input.profession !== undefined)
            payload.profession = input.profession;
          if (input.email !== undefined) payload.email = input.email;

          const updated = await userService.updateProfile(payload);

          set((state) => {
            if (!state.appUser) return state;
            return {
              appUser: {
                ...state.appUser,
                id: updated.id,
                clerkUserId: updated.clerk_user_id,
                nickname: updated.nickname,
                experienceLevel: updated.experience_level,
                profession: updated.profession,
                avatarUrl: updated.avatar_url,
                role: updated.role as AppUserProfile["role"],
              },
            };
          });
        } catch (e) {
          console.error(
            "updateAppUserProfile: API sync failed, keeping local value",
            e,
          );
        }
      },

      // Call clearAppState() from this store inside your signOut() handler,
      // alongside Clerk's own signOut(). Deliberately doesn't touch
      // onboarding — that lives in its own store now and shouldn't reset
      // just because someone signs out.
      clearAppState: () => set({ appUser: null }),

      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: "app-user-store",
      // v1: the app used to be wired to the in-memory debug user service, whose
      // fixture ("Div Patil" / debug@example.com) was persisted here and then
      // displayed as if it were the signed-in user. Dropping the v0 cache lets
      // the real profile refetch replace it.
      version: 1,
      migrate: () => ({ appUser: null }),
      storage: createJSONStorage(() => appUserStorage),
      partialize: (state) => ({
        appUser: state.appUser,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error("App-user store hydration failed:", error);
        } else {
          console.log("App-user store hydrated:", state);
        }
      },
    },
  ),
);

useAppUserStore.persist.onFinishHydration(() => {
  useAppUserStore.getState().setHasHydrated(true);
});

if (useAppUserStore.persist.hasHydrated()) {
  useAppUserStore.getState().setHasHydrated(true);
}
