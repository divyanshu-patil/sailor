import { UpdateProfilePayload, UserProfile, UserService, MAX_LENGTH, truncateField } from "./user.service";
export * from "@/types/user";
export { UserService, MAX_LENGTH };
// In-memory only — resets on reload. Mirrors userService's interface
// exactly so screens/hooks never need to know which one they're using.
let mockProfile: UserProfile = {
  id: "debug-user-1",
  clerk_user_id: "clerk_debug_1",
  email: "debug@example.com",
  nickname: "div",
  experience_level: "intermediate",
  profession: "finance_consulting",
  avatar_url: null,
  role: "user",
  created_at: new Date().toISOString(),
};

let deleted = false;

const DEBUG_DELAY = 1000;

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) =>
    setTimeout(() => resolve(value), DEBUG_DELAY),
  );
}

export const userService = {
  getProfile: async (): Promise<UserProfile> => {
    if (deleted) {
      throw new Error("Account has been deleted");
    }
    console.log("[debug] getProfile", mockProfile);
    // Apply max length validation to nickname
    const profile = {
      ...mockProfile,
      nickname: truncateField(mockProfile.nickname, MAX_LENGTH.nickname),
    };
    return delay(profile);
  },

  updateProfile: async (
    payload: UpdateProfilePayload,
  ): Promise<UserProfile> => {
    if (deleted) {
      throw new Error("Account has been deleted");
    }
    // Apply max length validation to input
    const sanitizedPayload = {
      ...payload,
      nickname: truncateField(payload.nickname, MAX_LENGTH.nickname),
    };
    mockProfile = { ...mockProfile, ...sanitizedPayload };
    console.log("[debug] updateProfile", mockProfile);
    return delay(mockProfile);
  },

  deleteAccount: async (): Promise<void> => {
    console.log("[debug] deleteAccount", mockProfile.id);
    deleted = true;
    return delay(undefined);
  },
};
