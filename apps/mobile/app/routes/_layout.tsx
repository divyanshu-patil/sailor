import React from "react";
import { Stack } from "expo-router";
import { useAppStore } from "@/store/auth-store";
import { ENV } from "@/lib/config/env";
import { ClerkProvider, ClerkLoaded, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";

function InitialLayout() {
  const isHydrated = useAppStore((s) => s._hasHydrated);
  const hasSeenOnboarding = useAppStore((s) => s.hasSeenOnboarding);
  const { isSignedIn, isLoaded } = useAuth();

  if (!isHydrated || !isLoaded) {
    return null; // or a splash/loading component
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
        <InitialLayout />
      </ClerkLoaded>
    </ClerkProvider>
  );
}
