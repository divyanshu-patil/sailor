import {
  create,
  type AxiosError,
  type InternalAxiosRequestConfig,
} from "axios";
import { ENV } from "../config/env";

const API_BASE_URL = ENV.API_URL;

export const apiClient = create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Call this once at app root after Clerk is ready
// Injects getToken so interceptor can call it without using hooks
export function setupApiAuth(getToken: () => Promise<string | null>) {
  apiClient.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      const token = await getToken();
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error: AxiosError) => Promise.reject(error),
  );
}

export default apiClient;
