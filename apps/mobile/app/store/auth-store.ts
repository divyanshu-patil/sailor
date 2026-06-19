import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createMMKV } from "react-native-mmkv";
import type {
  User,
  AuthTokens,
  LoginCredentials,
  SignUpCredentials,
} from "@/types/auth";
import { DEV_MODE, DEV_TOKENS, DEV_USER } from "@/constants/dev-mode";

// Initialize MMKV storage
const mmkv = createMMKV({
  id: "auth-storage",
});

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

interface AuthStore {
  user: User | null;
  tokens: AuthTokens | null;
  isLoading: boolean;
  hasSeenOnboarding: boolean;
  _hasHydrated: boolean;

  setUser: (user: User | null) => void;
  setTokens: (tokens: AuthTokens | null) => void;
  login: (credentials: LoginCredentials) => Promise<void>;
  signUp: (credentials: SignUpCredentials) => Promise<void>;
  logout: () => void;
  refreshTokens: () => Promise<void>;
  socialLogin: (provider: "apple" | "google") => Promise<void>;
  devLogin: () => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  setHasHydrated: (state: boolean) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      tokens: null,
      isLoading: false,
      hasSeenOnboarding: false,

      // Actions
      setUser: (user) => set({ user }),
      setTokens: (tokens) => set({ tokens }),

      login: async (credentials) => {
        set({ isLoading: true });
        try {
          // TODO: Replace with actual API call
          // const response = await api.post<{ user: User; tokens: AuthTokens }>("/auth/login", credentials);
          // set({ user: response.user, tokens: response.tokens });

          // Mock for now - remove when API is ready
          const mockUser: User = {
            id: "1",
            email: credentials.email,
            name: "Test User",
            createdAt: new Date().toISOString(),
          };
          const mockTokens: AuthTokens = {
            accessToken: "mock_access_token",
            refreshToken: "mock_refresh_token",
            expiresAt: Date.now() + 3600000,
          };
          set({ user: mockUser, tokens: mockTokens });
        } catch (error) {
          set({ user: null, tokens: null });
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      signUp: async (credentials) => {
        set({ isLoading: true });
        try {
          // TODO: Replace with actual API call
          // const response = await api.post<{ user: User; tokens: AuthTokens }>("/auth/signup", credentials);
          // set({ user: response.user, tokens: response.tokens });

          // Mock for now - remove when API is ready
          const mockUser: User = {
            id: "1",
            email: credentials.email,
            name: credentials.name,
            createdAt: new Date().toISOString(),
          };
          const mockTokens: AuthTokens = {
            accessToken: "mock_access_token",
            refreshToken: "mock_refresh_token",
            expiresAt: Date.now() + 3600000,
          };
          set({ user: mockUser, tokens: mockTokens });
        } catch (error) {
          set({ user: null, tokens: null });
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      logout: () => {
        set({ user: null, tokens: null });
      },

      refreshTokens: async () => {
        const { tokens } = get();
        if (!tokens?.refreshToken) {
          throw new Error("No refresh token available");
        }

        try {
          // TODO: Replace with actual API call
          // const response = await api.post<AuthTokens>("/auth/refresh", {
          //   refreshToken: tokens.refreshToken,
          // });
          // set({ tokens: response });

          // Mock for now - remove when API is ready
          const newTokens: AuthTokens = {
            accessToken: "mock_refreshed_token",
            refreshToken: "mock_new_refresh_token",
            expiresAt: Date.now() + 3600000,
          };
          set({ tokens: newTokens });
        } catch (error) {
          // If refresh fails, logout user
          get().logout();
          throw error;
        }
      },

      socialLogin: async (provider) => {
        set({ isLoading: true });
        try {
          // TODO: Replace with actual API call based on provider
          // const response = await api.post<{ user: User; tokens: AuthTokens }>(`/auth/${provider}`, {});
          // set({ user: response.user, tokens: response.tokens });

          // Mock for now - remove when API is ready
          const mockUser: User = {
            id: "1",
            email: `user@${provider}.com`,
            name: `${provider.charAt(0).toUpperCase() + provider.slice(1)} User`,
            createdAt: new Date().toISOString(),
          };
          const mockTokens: AuthTokens = {
            accessToken: `mock_${provider}_token`,
            refreshToken: `mock_${provider}_refresh`,
            expiresAt: Date.now() + 3600000,
          };
          set({ user: mockUser, tokens: mockTokens });
        } catch (error) {
          set({ user: null, tokens: null });
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      completeOnboarding: () => {
        set({ hasSeenOnboarding: true });
      },

      resetOnboarding: () => {
        set({ hasSeenOnboarding: false });
      },

      devLogin: () => {
        if (!DEV_MODE) {
          console.warn(
            "DEV_MODE is false. Set DEV_MODE = true to enable dev login.",
          );
          return;
        }
        set({ user: DEV_USER, tokens: DEV_TOKENS });
      },

      _hasHydrated: false,
      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: "auth-store",
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        user: state.user,
        tokens: state.tokens,
        hasSeenOnboarding: state.hasSeenOnboarding,
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

export const selectIsAuthenticated = (s: AuthStore) =>
  DEV_MODE ? true : !!s.tokens?.accessToken;

// Subscribe outside the create() call, after useAuthStore is fully assigned
useAuthStore.persist.onFinishHydration(() => {
  useAuthStore.getState().setHasHydrated(true);
});

// Handle the case where hydration already finished before this ran
if (useAuthStore.persist.hasHydrated()) {
  useAuthStore.getState().setHasHydrated(true);
}
