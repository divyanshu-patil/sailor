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
  API_URL: getEnvVar("EXPO_PUBLIC_API_URL", process.env.EXPO_PUBLIC_API_URL),

  // Public SDK keys — safe to ship in the bundle, unlike the RevenueCat *secret*
  // key, which is server-only. Not required: the app runs fine without billing
  // configured (and has to, on web, where there is no native Purchases module),
  // so a missing key disables purchases rather than crashing the app at import.
  REVENUECAT_IOS_API_KEY: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? "",
  REVENUECAT_ANDROID_API_KEY:
    process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? "",
} as const;
