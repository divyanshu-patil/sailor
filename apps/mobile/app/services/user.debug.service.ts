import { UserProfile } from "@/services/user.service";

// In-memory only — resets on reload. Mirrors userService's interface
// exactly so screens/hooks never need to know which one they're using.
let mockProfile: UserProfile = {
  id: "debug-user-1",
  clerk_user_id: "clerk_debug_1",
  email: "debug@example.com",
  role: "user",
  created_at: new Date().toISOString(),
};

let deleted = false;

const DEBUG_DELAY = 400;

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
    return delay(mockProfile);
  },

  updateProfile: async (payload: { email?: string }): Promise<UserProfile> => {
    if (deleted) {
      throw new Error("Account has been deleted");
    }
    mockProfile = { ...mockProfile, ...payload };
    console.log("[debug] updateProfile", mockProfile);
    return delay(mockProfile);
  },

  deleteAccount: async (): Promise<void> => {
    console.log("[debug] deleteAccount", mockProfile.id);
    deleted = true;
    return delay(undefined);
  },
};
