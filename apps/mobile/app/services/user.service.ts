import { apiClient } from "@/lib/api/client";
import { ExperienceLevel, Profession, UserProfile } from "@/types/user";
export * from "@/types/user";

// Max length constraints for profile fields
export const MAX_LENGTH = {
  nickname: 30,
  fullName: 100,
} as const;

// Helper to truncate string to max length
export function truncateField(value: string | null | undefined, maxLength: number): string {
  if (!value) return "";
  return value.slice(0, maxLength);
}

export interface UpdateProfilePayload {
  email?: string;
  full_name?: string;
  nickname?: string;
  experience_level?: ExperienceLevel;
  profession?: Profession | null;
  /** One-way on the server: sending false is ignored, so there is no way for a
   *  stale client to put an account back through a flow it has finished. */
  onboarding_completed?: boolean;
  profile_setup_completed?: boolean;
}

export type UserService = typeof userService;

export const userService = {
  getProfile: async (): Promise<UserProfile> => {
    try {
      const response = await apiClient.get<UserProfile>(
        "/api/v1/users/profile",
      );
      // Apply max length validation to nickname
      const profile = response.data;
      return {
        ...profile,
        nickname: truncateField(profile.nickname, MAX_LENGTH.nickname),
        full_name: truncateField(profile.full_name, MAX_LENGTH.fullName),
      };
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
