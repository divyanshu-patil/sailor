import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAppStore } from "@/store/auth-store";
import { useAuth } from "@clerk/expo";

export default function Index() {
  const router = useRouter();
  // const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const { isSignedIn } = useAuth();
  const hasSeenOnboarding = useAppStore((s) => s.hasSeenOnboarding);
  const isHydrated = useAppStore((s) => s._hasHydrated);

  useEffect(() => {
    if (!isHydrated) return;

    if (!hasSeenOnboarding) {
      router.replace("/(onboarding)/welcome");
    } else if (isSignedIn) {
      router.replace("/(authenticated)");
    } else {
      router.replace("/(unauthenticated)/login");
    }
  }, [isHydrated, isSignedIn, hasSeenOnboarding]);

  if (!isHydrated) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return null;
}
