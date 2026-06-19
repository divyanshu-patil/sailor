import axios from "axios";

const API_BASE_URL = process.env.Expo_API_URL || "http://localhost:8000/";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 120000,
  withCredentials: true,
});

// Request interceptor - add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("api_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor - handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("api_token");
      window.location.href = "/settings";
    }
    const message =
      error.response?.data?.message ||
      error.response?.data?.detail ||
      error.message ||
      "An error occurred";
    return Promise.reject(new Error(message));
  },
);

export default apiClient;
