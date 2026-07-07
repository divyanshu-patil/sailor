import apiClient from "@/lib/api/client";

export interface UserProfile {
  id: string;
  clerk_user_id: string;
  email: string;
  role: "user" | "admin";
  created_at: string;
}

export const userService = {
  getProfile: async (): Promise<UserProfile> => {
    try {
      const response = await apiClient.get<UserProfile>("/api/v1/users/profile");
      console.log("profile response", response.data);
      return response.data;
    } catch (e: any) {
      console.log("profile error", e.response?.data, e.response?.status);
      throw e;
    }
  },

  updateProfile: async (
    payload: { email?: string }
  ): Promise<UserProfile> => {
    const response = await apiClient.patch<UserProfile>(
      "/api/v1/users/profile",
      payload
    );
    return response.data;
  },
};