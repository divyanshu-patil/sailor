import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";
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

// AxiosRequestConfig, not InternalAxiosRequestConfig: the "internal" shape is
// what axios hands *interceptors* after it has filled in the defaults, so it
// requires `headers`. Typing the call sites with it meant no caller could pass
// `{ params }` without also inventing a headers object — which is why the
// public config type is the right one here.
export const apiClient = {
  get: <T>(url: string, config?: AxiosRequestConfig) => api.get<T>(url, config),
  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    api.post<T>(url, data, config),
  patch: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    api.patch<T>(url, data, config),
  put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    api.put<T>(url, data, config),
  delete: <T>(url: string, config?: AxiosRequestConfig) =>
    api.delete<T>(url, config),
};

/**
 * The message to show a user for a failed request.
 *
 * FastAPI's `detail` is a plain string for the errors we raise ourselves, but a
 * *list* of `{loc, msg}` objects for a 422 from request validation. Reading it
 * as a string put "[object Object]" in front of users — and, worse, hid which
 * field was actually rejected while debugging.
 */
export function apiErrorMessage(error: any, fallback = "Something went wrong"): string {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string" && detail) return detail;
  // Quota refusals (402) carry an object: a machine-readable `code` alongside
  // copy already written for the user. See backend app/services/quota.py.
  if (typeof detail?.message === "string") return detail.message;
  if (Array.isArray(detail) && detail.length) {
    return detail
      .map((item: any) => {
        // loc is ["body", "description"]; the field name is the useful half.
        const field = Array.isArray(item?.loc) ? item.loc[item.loc.length - 1] : null;
        return field ? `${field}: ${item?.msg ?? "invalid"}` : item?.msg;
      })
      .filter(Boolean)
      .join("\n");
  }
  return error?.message || fallback;
}

export default apiClient;