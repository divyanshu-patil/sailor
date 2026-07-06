import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createMMKV } from "react-native-mmkv";

// Initialize MMKV storage
const mmkv = createMMKV({
  id: "auth-storage",
});

// MMKV here only stores non-sensitive, app-specific UI state —
// NOT auth/session data (Clerk's tokenCache + expo-secure-store owns that).

// - hasSeenOnboarding: persisted so onboarding doesn't replay on every app restart
// - appUser: cached FastAPI /profile response, so the app can render instantly on
//   cold start (and offline) instead of waiting on a network call

// Safe to keep unencrypted here since nothing stored is a credential —
// losing this data just means re-showing onboarding or a brief stale profile,
// not a security risk like a leaked session token would be.

// Custom storage adapter for MMKV
const mmkvStorage = {
  getItem: (name: string): string | null => {
    try {
      const value = mmkv.getString(name);
      if (!value) return null;
      // sanity-check it's parseable before handing to zustand
      JSON.parse(value);
      return value;
    } catch (e) {
      console.error("MMKV getItem parse error, clearing corrupted key:", e);
      mmkv.remove(name);
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      mmkv.set(name, value);
    } catch (e) {
      console.error("MMKV setItem error:", e);
    }
  },
  removeItem: (name: string): void => {
    try {
      mmkv.remove(name);
    } catch (e) {
      console.error("MMKV removeItem error:", e);
    }
  },
};

// profile shape (data from supabase `users` table).
// Clerk has actual identity (email, password)
// app-specific that lives in YOUR database, keyed by Clerk's user id.
export interface AppUserProfile {
  id: string; // DB primary key
  clerkUserId: string; // Clerk's `sub` claim
  email: string;
  role: "user" | "admin" | "dev";
  // ...add as needed from database.
}


interface AppStore {
  hasSeenOnboarding: boolean;
  _hasHydrated: boolean;
  appUser: AppUserProfile | null;

  completeOnboarding: (val: boolean) => void;
  resetOnboarding: () => void;
  setHasHydrated: (state: boolean) => void;
  setAppUser: (user: AppUserProfile | null) => void;
  clearAppState: () => void; // call this on sign-out
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      // Initial state
      hasSeenOnboarding: false,
      _hasHydrated: false,
      appUser: null,
 
      // Actions
      completeOnboarding: (val) => {
        set({ hasSeenOnboarding: val });
      },
 
      resetOnboarding: () => {
        set({ hasSeenOnboarding: false });
      },
 
      setAppUser: (appUser) => set({ appUser }),
 
      // Call clearAppState() from this store inside your signOut() handler,
      //  alongside Clerk's own signOut().
      clearAppState: () => set({ appUser: null }),
 
      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: "app-store",
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        hasSeenOnboarding: state.hasSeenOnboarding,
        appUser: state.appUser,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error("Hydration failed:", error);
        } else {
          console.log("Hydrated:", state);
        }
      },
    },
  ),
);
 
// Subscribe outside the create() call, after useAppStore is fully assigned
useAppStore.persist.onFinishHydration(() => {
  useAppStore.getState().setHasHydrated(true);
});
 
// Handle the case where hydration already finished before this ran
if (useAppStore.persist.hasHydrated()) {
  useAppStore.getState().setHasHydrated(true);
}