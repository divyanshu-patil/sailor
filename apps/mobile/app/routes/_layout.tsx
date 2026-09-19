import React, { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { ENV } from "@/lib/config/env";
import { ClerkProvider, ClerkLoaded, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { View } from "react-native";
import { setupApiAuth } from "@/lib/api/client";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { syncAppearanceOptionsOnce } from "@/services/appearance-sync.service";
import { useOnboardingStore } from "@/store/onboarding.store";
import { syncPreferencesOnce } from "@/services/preferences-sync.service";
import { useRevenueCatBootstrap } from "@/hooks/use-subscription";
import * as Sentry from "@sentry/react-native";
import * as Notifications from "expo-notifications";
import { startReminderSync } from "@/lib/daily-reminder";
import { startStreakAlertSync } from "@/lib/streak-alarm";
import { startHapticsSync } from "@/lib/haptics";
import { primeWidgetAssets } from "@/lib/widget-assets";
import * as Font from "expo-font";
import { preloadMascots } from "@/screens/daily-practice/components/Mascot";
import {
  reloadWidgets,
  resyncWidgets,
  startStreakWidgetSync,
} from "@/lib/widget-sync";

if (__DEV__ && !ENV.SENTRY_DSN) {
  // Silent-by-default is how a whole afternoon gets lost: with no DSN the SDK
  // installs fine and captureException returns an id, it just never sends.
  console.warn("EXPO_PUBLIC_SENTRY_DSN is empty — Sentry is disabled.");
}

Sentry.init({
  dsn: ENV.SENTRY_DSN,
  enabled: !!ENV.SENTRY_DSN,
  // Off even in dev: the SDK's own logger warns on every hot reload
  // ("Overwriting already set root component creation timestamp") and buries
  // the app's console output. Flip to __DEV__ to debug the SDK itself.
  debug: false,
  sendDefaultPii: true,
  enableLogs: true,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [
    Sentry.mobileReplayIntegration(),
    Sentry.feedbackIntegration(),
  ],
});

function ApiAuthSetup() {
  const { getToken, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isSignedIn) return; // wait until signed in
    // Nothing is logged here on purpose: a session JWT in the Metro console
    // ends up in terminal scrollback, screen shares and bug reports, and it is
    // a working credential until it expires.
    setupApiAuth(getToken);
  }, [getToken, isSignedIn]);

  return null;
}

/**
 * RevenueCat, configured once and kept in step with the Clerk session.
 *
 * Inside ClerkLoaded like ApiAuthSetup, and for the same reason: it reads the
 * signed-in user id, and acting on a half-loaded session would attach purchases
 * to the wrong app user.
 */
function PurchasesSetup() {
  useRevenueCatBootstrap();
  return null;
}

/**
 * Opens daily practice when the reminder is tapped.
 *
 * Expo Router resolves `sailor://daily-practice` on its own for a URL the OS
 * hands to the app, but a notification response isn't one of those — the URL is
 * in the payload, and something has to read it. Handled here rather than in the
 * screen because the app is usually cold when this fires.
 */
function ReminderRouting() {
  const router = useRouter();

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const url = response.notification.request.content.data?.url;
        if (typeof url === "string" && url.endsWith("daily-practice")) {
          router.push("/(authenticated)/daily-practice");
        }
      },
    );
    return () => subscription.remove();
  }, [router]);

  return null;
}

function InitialLayout() {
  const isHydrated = useOnboardingStore((s) => s._hasHydrated);
  const hasSeenOnboarding = useOnboardingStore((s) => s.hasSeenOnboarding);
  const { isSignedIn, isLoaded } = useAuth();

  useEffect(() => {
    syncPreferencesOnce();
    syncAppearanceOptionsOnce();
  }, []);

  // Both watch the preference store for the rest of the app's life, so the
  // reminder the OS has scheduled and the colour the widget is drawn in stay in
  // step with Settings without either screen having to remember to push them.
  useEffect(() => {
    // Importing the sync module has already constructed both widgets, writing
    // their layouts into the App Group. This picks up any widget that was added
    // to the home screen before that ever happened.
    reloadWidgets();

    // The mascots have to reach the shared container before any push names
    // them, or the first tile of a fresh install draws without a character.
    // Fire-and-forget: a tile is still correct without one, and blocking the
    // first frame on five file copies would be the worse trade.
    void primeWidgetAssets().then(resyncWidgets);

    // Mascots are the first thing an empty or failed screen shows; loaded
    // now so they don't pop in a beat after the words around them.
    preloadMascots().catch(() => {});
    // Kalam is also embedded via app.json, but only after a prebuild; loading
    // it here makes the handwritten notes work in any build.
    Font.loadAsync({
      "Kalam-Light": require("@expo-google-fonts/kalam/300Light/Kalam_300Light.ttf"),
      "Kalam-Regular": require("@expo-google-fonts/kalam/400Regular/Kalam_400Regular.ttf"),
      "Kalam-Bold": require("@expo-google-fonts/kalam/700Bold/Kalam_700Bold.ttf"),
    }).catch(() => {});

    const stopReminderSync = startReminderSync();
    const stopStreakAlerts = startStreakAlertSync();
    const stopWidgetSync = startStreakWidgetSync();
    // Drives Pulsar's global switch from the "Emotion Haptics" preference. That
    // toggle has existed in Settings with nothing reading it — this makes it
    // work, for the existing call sites in the script wizard as well as the new
    // ones here.
    const stopHapticsSync = startHapticsSync();
    return () => {
      stopReminderSync();
      stopStreakAlerts();
      stopWidgetSync();
      stopHapticsSync();
    };
  }, []);

  if (!isHydrated || !isLoaded) {
    return <View style={{ flex: 1, backgroundColor: "#fff" }} />; // white screen instead of null
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="index" />

      <Stack.Protected guard={!hasSeenOnboarding}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>

      <Stack.Protected guard={hasSeenOnboarding && !isSignedIn}>
        <Stack.Screen name="(unauthenticated)" />
      </Stack.Protected>

      <Stack.Protected guard={hasSeenOnboarding && isSignedIn}>
        <Stack.Screen name="(authenticated)" />
      </Stack.Protected>
    </Stack>
  );
}

function RootLayout() {
  return (
    <ClerkProvider
      publishableKey={ENV.CLERK_PUBLISHABLE_KEY}
      tokenCache={tokenCache}
    >
      <ClerkLoaded>
        <KeyboardProvider>
          <ApiAuthSetup />
          <PurchasesSetup />
          <ReminderRouting />
          <InitialLayout />
        </KeyboardProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}

export default Sentry.wrap(RootLayout);
