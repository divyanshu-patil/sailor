// Authentication types for the Sailors app

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignUpCredentials extends LoginCredentials {
  name: string;
}

export const SocialAuthProvider = {
  APPLE: "apple",
  GOOGLE: "google",
} as const;

export type SocialAuthProviderType =
  (typeof SocialAuthProvider)[keyof typeof SocialAuthProvider];

export interface SocialAuthResponse {
  user: User;
  tokens: AuthTokens;
}

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}
