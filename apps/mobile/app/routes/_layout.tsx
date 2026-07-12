import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { useAppStore } from "@/store/auth-store";
import { ENV } from "@/lib/config/env";
import { ClerkProvider, ClerkLoaded, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { View } from "react-native";
import { setupApiAuth } from "@/lib/api/client";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { syncAppearanceOptionsOnce } from "@/services/appearance-sync.service";

function ApiAuthSetup() {
  const { getToken, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isSignedIn) return; // wait until signed in
    getToken().then((t) => console.log("token:", t ? "got it" : "null"));
    setupApiAuth(getToken);
  }, [getToken, isSignedIn]);

  return null;
}

function InitialLayout() {
  const isHydrated = useAppStore((s) => s._hasHydrated);
  const hasSeenOnboarding = useAppStore((s) => s.hasSeenOnboarding);
  const { isSignedIn, isLoaded } = useAuth();

  useEffect(() => {
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
          <InitialLayout />
        </KeyboardProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
