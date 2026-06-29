import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { ENV } from "../config/env";

const API_BASE_URL = ENV.API_URL;

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Call this once at app root after Clerk is ready
// Injects getToken so interceptor can call it without using hooks
export function setupApiAuth(getToken: () => Promise<string | null>) {
  api.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      const token = await getToken();
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error: AxiosError) => Promise.reject(error)
  );
}

export const apiClient = {
  get: <T>(url: string, config?: InternalAxiosRequestConfig) =>
    api.get<T>(url, config),
  post: <T>(url: string, data?: unknown, config?: InternalAxiosRequestConfig) =>
    api.post<T>(url, data, config),
  patch: <T>(url: string, data?: unknown, config?: InternalAxiosRequestConfig) =>
    api.patch<T>(url, data, config),
  delete: <T>(url: string, config?: InternalAxiosRequestConfig) =>
    api.delete<T>(url, config),
};

export default apiClient;