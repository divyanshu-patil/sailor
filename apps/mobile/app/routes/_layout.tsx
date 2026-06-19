import { Stack } from "expo-router";
import { useAuthStore } from "@/store/auth-store";
import useAuthenticated from "@/hooks/use-authenticated";

export default function RootLayout() {
  const isHydrated = useAuthStore((s) => s._hasHydrated); // see note below
  const isAuthenticated = useAuthenticated();
  const hasSeenOnboarding = useAuthStore((s) => s.hasSeenOnboarding);

  if (!isHydrated) {
    return null; // or a loading screen
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    >
      <Stack.Protected guard={!hasSeenOnboarding}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>

      <Stack.Protected guard={hasSeenOnboarding && !isAuthenticated}>
        <Stack.Screen name="(unauthenticated)" />
      </Stack.Protected>

      <Stack.Protected guard={hasSeenOnboarding && isAuthenticated}>
        <Stack.Screen name="(authenticated)" />
      </Stack.Protected>
    </Stack>
  );
}
