import { AuthTokens, User } from "@/types/auth";

export const DEV_MODE = true;

// Dev user data - used when DEV_MODE is true
export const DEV_USER: User = {
  id: "dev-user-1",
  email: "dev@sailor.com",
  name: "Dev User",
  avatarUrl: undefined,
  createdAt: new Date().toISOString(),
};

export const DEV_TOKENS: AuthTokens = {
  accessToken: "dev_access_token",
  refreshToken: "dev_refresh_token",
  expiresAt: Date.now() + 86400000, // 24 hours
};
