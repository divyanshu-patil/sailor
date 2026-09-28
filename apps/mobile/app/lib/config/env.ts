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

  // RevenueCat kill switch. Off: the SDK isn't compiled (package.json
  // expo.autolinking.exclude) or bundled (metro.config.js), and everyone gets
  // Pro. Turning it back on means undoing both of those too.
  REVENUECAT_ENABLED: false,

  // Public SDK keys — safe to ship in the bundle, unlike the RevenueCat *secret*
  // key, which is server-only. Not required: the app runs fine without billing
  // configured (and has to, on web, where there is no native Purchases module),
  // so a missing key disables purchases rather than crashing the app at import.
  REVENUECAT_IOS_API_KEY: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? "",
  REVENUECAT_ANDROID_API_KEY:
    process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? "",

  // Public by design (a DSN only grants "send events here"). Optional: without
  // it Sentry stays off rather than crashing a fresh clone at import.
  SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN ?? "",
} as const;
