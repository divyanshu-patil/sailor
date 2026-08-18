import React, { useEffect } from "react";
import { Stack } from "expo-router";
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

function InitialLayout() {
  const isHydrated = useOnboardingStore((s) => s._hasHydrated);
  const hasSeenOnboarding = useOnboardingStore((s) => s.hasSeenOnboarding);
  const { isSignedIn, isLoaded } = useAuth();

  useEffect(() => {
    syncPreferencesOnce();
    syncAppearanceOptionsOnce();
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

export default function RootLayout() {
  return (
    <ClerkProvider
      publishableKey={ENV.CLERK_PUBLISHABLE_KEY}
      tokenCache={tokenCache}
    >
      <ClerkLoaded>
        <KeyboardProvider>
          <ApiAuthSetup />
          <PurchasesSetup />
          <InitialLayout />
        </KeyboardProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
