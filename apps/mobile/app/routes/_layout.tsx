import React, { useEffect, useRef } from "react";
import { Stack, useRouter } from "expo-router";
import { ENV } from "@/lib/config/env";
import { ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { setupApiAuth } from "@/lib/api/client";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { syncAppearanceOptionsOnce } from "@/services/appearance-sync.service";
import * as SplashScreen from "expo-splash-screen";

import { useAppBootstrap } from "@/hooks/use-app-bootstrap";
import { useAuthGate } from "@/hooks/use-auth-gate";
import { useOnboardingGate } from "@/hooks/use-onboarding-gate";
import { useOnboardingCompletionStore } from "@/store/onboarding-completion.store";
import { useOnboardingPendingStore } from "@/store/onboarding-pending.store";
import { syncPreferencesOnce } from "@/services/preferences-sync.service";
import { useRevenueCatBootstrap } from "@/hooks/use-subscription";
import MascotPreloader from "@/components/ui/mascot-preloader";
import { useAppUserStore } from "@/store/app-user.store";
import { useProIntroStore } from "@/store/pro-intro.store";
import * as Sentry from "@sentry/react-native";
import * as Notifications from "expo-notifications";
import { startReminderSync } from "@/lib/daily-reminder";
import { startStreakAlertSync } from "@/lib/streak-alarm";
import { startHapticsSync } from "@/lib/haptics";
import { primeWidgetAssets } from "@/lib/widget-assets";
import * as Font from "expo-font";
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
 * Guards on the signed-in user id itself rather than on a wrapper that withheld
 * the whole tree: acting on a half-loaded session would attach purchases to the
 * wrong app user, and the hook below waits for a real id before it does.
 */
function PurchasesSetup() {
  useRevenueCatBootstrap();
  return null;
}

/**
 * Opens daily practice when the reminder is tapped.
 *
 * Expo Router resolves `sailors://daily-practice` on its own for a URL the OS
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

// Held from module load, before the first render, so there is no window where
// iOS has already taken the splash down and the app has nothing to show.
SplashScreen.preventAutoHideAsync().catch(() => {});

function InitialLayout() {
  const isOnboardingCompletionHydrated = useOnboardingCompletionStore(
    (s) => s._hasHydrated,
  );
  const isOnboardingPendingHydrated = useOnboardingPendingStore(
    (s) => s._hasHydrated,
  );
  const onboardingCompletedForUserId = useOnboardingCompletionStore(
    (s) => s.completedForUserId,
  );
  const onboardingCheckedForUserId = useOnboardingCompletionStore(
    (s) => s.checkedForUserId,
  );
  const { ready: authReady, isSignedIn, userId } = useAuthGate();
  const assetsReady = useAppBootstrap();
  // Nobody signed in on this device, by the look of the disk: the front door
  // is next, and its mascots are the slowest thing on it.
  const likelySignedOut = !useAppUserStore((s) => s.appUser?.clerkUserId);

  // Signing in during this launch owes the Sailors Pro screen. Caught here, as
  // the answer flipping from signed-out to signed-in, rather than at each of
  // the four places a sign-in can finish (password, email code, Apple,
  // Google): one watcher covers them all, and whichever gets added next.
  const wasSignedIn = useRef<boolean | null>(null);
  useEffect(() => {
    if (!authReady) return;
    if (wasSignedIn.current === false && isSignedIn) {
      useProIntroStore.getState().markPending();
    }
    wasSignedIn.current = isSignedIn;
  }, [authReady, isSignedIn]);

  // Reconciles the local completion flags with the server's, so a reinstall or
  // a second device does not repeat a flow this account has already finished.
  // It only ever writes locally, and only toward "done" — the router below
  // keeps reading the local stores, which are on disk before the first frame.
  useOnboardingGate(userId);

  // Completion is per Clerk user, so a different account on the same device
  // still runs onboarding once.
  const hasCompletedOnboarding =
    !!userId && onboardingCompletedForUserId === userId;

  // Signed in, but not finished on this device: the account's own flag decides
  // whether that means onboarding, so the splash holds until the server has
  // answered (or the gate has given up waiting).
  const onboardingKnown =
    !isSignedIn || hasCompletedOnboarding || onboardingCheckedForUserId === userId;

  // Everything the first frame needs: the persisted stores, a decision about
  // who is signed in and whether they still owe onboarding, and the home
  // screen's own fonts and images.
  const canRender =
    isOnboardingCompletionHydrated &&
    isOnboardingPendingHydrated &&
    authReady &&
    onboardingKnown &&
    assetsReady;

  // Per account, not per launch: preferences are the server's, logout clears
  // the local copy, and a sign-in partway through a launch has to read them
  // back — once per launch, the read ran signed out and failed.
  useEffect(() => {
    if (userId) syncPreferencesOnce();
  }, [userId]);
  useEffect(() => {
    syncAppearanceOptionsOnce();
  }, []);

  // The splash stays up until there is something real behind it. `hideAsync`
  // is safe to call more than once, so no guard is needed beyond the flag.
  useEffect(() => {
    if (canRender) SplashScreen.hideAsync().catch(() => {});
  }, [canRender]);

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

    // Kalam only. The AlanSans faces used to be repeated here as well as in
    // routes/index.tsx, so every launch parsed them twice; index.tsx owns them
    // now. Kalam is embedded via app.json but only after a prebuild, so loading
    // it here is what makes the handwritten notes work in any build.
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

  // `authReady` rather than Clerk's `isLoaded`: offline, that never flips, and
  // this early return was the blank white screen on launch. See useAuthGate.
  if (!canRender) {
    // Nothing visible, not a white view: the splash screen is still up, and
    // drawing a blank page over it is what produced the white flash between
    // the two. For a signed-out launch, the front door's mascots start
    // decoding here, under the splash, so they're already in lottie-ios's
    // cache when the screen that shows them mounts — instead of that screen
    // waiting on its own decode.
    return likelySignedOut ? <MascotPreloader /> : null;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: "Sailors" }} />

      {/* The base screen is the app's front door. "Get started" opens the
          onboarding flow the first time; once it is done the button morphs
          base into its create-account state instead. */}
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="(unauthenticated)" options={{ title: "Sign In" }} />
      </Stack.Protected>

      {/*
        One onboarding flow, mounted whenever onboarding is not finished —
        signed out (the first run, before sign-up) or signed in (a new device
        that never ran it). The workflow owns its own position.
      */}
      <Stack.Protected guard={!hasCompletedOnboarding}>
        <Stack.Screen name="(onboarding)" options={{ title: "Onboarding" }} />
      </Stack.Protected>

      <Stack.Protected guard={isSignedIn && hasCompletedOnboarding}>
        <Stack.Screen name="(authenticated)" options={{ title: "Sailors" }} />
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
      {/*
        No ClerkLoaded here on purpose. It renders NOTHING until Clerk has
        resolved its session against Clerk's servers, so with no connection the
        whole app tree — including InitialLayout — never mounted at all, and the
        launch was a blank white screen with no way out of it.

        Nothing below actually needed the wrapper. ApiAuthSetup and
        PurchasesSetup are effect-only and already guard on `isSignedIn`, so
        they no-op until the session appears and then run on their own when it
        does. Deciding when there is enough to render is InitialLayout's job,
        and it now does it from disk when Clerk cannot answer (useAuthGate).
      */}
      <KeyboardProvider>
        <ApiAuthSetup />
        <PurchasesSetup />
        <ReminderRouting />
        <InitialLayout />
      </KeyboardProvider>
    </ClerkProvider>
  );
}

export default Sentry.wrap(RootLayout);
