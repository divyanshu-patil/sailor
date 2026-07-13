import { apiClient } from "@/lib/api/client";
import { ExperienceLevel, Profession, UserProfile } from "@/types/user";
export * from "@/types/user";

export interface UpdateProfilePayload {
  email?: string;
  full_name?: string;
  nickname?: string;
  experience_level?: ExperienceLevel;
  profession?: Profession | null;
}

export const userService = {
  getProfile: async (): Promise<UserProfile> => {
    try {
      const response = await apiClient.get<UserProfile>(
        "/api/v1/users/profile",
      );
      return response.data;
    } catch (e: any) {
      console.log("profile error", e.response?.data, e.response?.status);
      throw e;
    }
  },

  updateProfile: async (
    payload: UpdateProfilePayload,
  ): Promise<UserProfile> => {
    try {
      const response = await apiClient.patch<UserProfile>(
        "/api/v1/users/profile",
        payload,
      );
      return response.data;
    } catch (e: any) {
      console.log("update profile error", e.response?.data, e.response?.status);
      throw e;
    }
  },

  deleteAccount: async (): Promise<void> => {
    try {
      await apiClient.delete("/api/v1/users/profile");
    } catch (e: any) {
      console.log("delete account error", e.response?.data, e.response?.status);
      throw e;
    }
  },
};
