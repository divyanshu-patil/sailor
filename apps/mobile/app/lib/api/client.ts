import axios, { type AxiosError, type InternalAxiosRequestConfig, type AxiosResponse } from "axios";
import { useAuthStore } from "@/store/auth-store";
import type { ApiError } from "@/types/auth";

// Base API configuration
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "https://api.sailor.com";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor - attaches auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken;

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handles token refresh and errors
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error: AxiosError<ApiError>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Handle 401 Unauthorized - try to refresh token
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        await useAuthStore.getState().refreshTokens();

        // Retry the original request with new token
        const newToken = useAuthStore.getState().accessToken;
        if (newToken && originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }

        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed - logout user
        useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      }
    }

    // Return structured error
    return Promise.reject(error);
  }
);

// API methods helper
export const apiClient = {
  get: <T>(url: string, config?: InternalAxiosRequestConfig) =>
    api.get<T>(url, config),

  post: <T>(url: string, data?: unknown, config?: InternalAxiosRequestConfig) =>
    api.post<T>(url, data, config),

  put: <T>(url: string, data?: unknown, config?: InternalAxiosRequestConfig) =>
    api.put<T>(url, data, config),

  patch: <T>(url: string, data?: unknown, config?: InternalAxiosRequestConfig) =>
    api.patch<T>(url, data, config),

  delete: <T>(url: string, config?: InternalAxiosRequestConfig) =>
    api.delete<T>(url, config),
};

export default apiClient;