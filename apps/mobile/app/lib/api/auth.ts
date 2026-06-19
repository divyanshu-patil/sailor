import { apiClient } from "./client";
import type { User, AuthTokens, LoginCredentials, SignUpCredentials, SocialAuthResponse } from "@/types/auth";

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<{ user: User; tokens: AuthTokens }> => {
    const response = await apiClient.post<{ user: User; tokens: AuthTokens }>("/auth/login", credentials);
    return response.data;
  },

  signUp: async (credentials: SignUpCredentials): Promise<{ user: User; tokens: AuthTokens }> => {
    const response = await apiClient.post<{ user: User; tokens: AuthTokens }>("/auth/signup", credentials);
    return response.data;
  },

  refreshTokens: async (refreshToken: string): Promise<AuthTokens> => {
    const response = await apiClient.post<AuthTokens>("/auth/refresh", { refreshToken });
    return response.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post("/auth/logout");
  },

  appleSignIn: async (): Promise<SocialAuthResponse> => {
    const response = await apiClient.post<SocialAuthResponse>("/auth/apple");
    return response.data;
  },

  googleSignIn: async (): Promise<SocialAuthResponse> => {
    const response = await apiClient.post<SocialAuthResponse>("/auth/google");
    return response.data;
  },

  forgotPassword: async (email: string): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>("/auth/forgot-password", { email });
    return response.data;
  },

  resetPassword: async (token: string, newPassword: string): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>("/auth/reset-password", { token, newPassword });
    return response.data;
  },
};

export default authApi;