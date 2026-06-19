import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/store/auth-store";
import useAuthenticated from "@/hooks/use-authenticated";

export default function Index() {
  const router = useRouter();
  const isAuthenticated = useAuthenticated();
  const hasSeenOnboarding = useAuthStore((s) => s.hasSeenOnboarding);
  const isHydrated = useAuthStore((s) => s._hasHydrated);

  useEffect(() => {
    if (!isHydrated) return;

    if (!hasSeenOnboarding) {
      router.replace("/(onboarding)/welcome");
    } else if (isAuthenticated) {
      router.replace("/(authenticated)");
    } else {
      router.replace("/(unauthenticated)/login");
    }
  }, [isHydrated, isAuthenticated, hasSeenOnboarding]);

  if (!isHydrated) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return null;
}
