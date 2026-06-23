
function getEnvVar(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const ENV = {
  CLERK_PUBLISHABLE_KEY: getEnvVar(
    "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY",
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
  ),
  API_URL: getEnvVar(
    "EXPO_PUBLIC_API_URL",
    process.env.EXPO_PUBLIC_API_URL,
  ),
} as const;