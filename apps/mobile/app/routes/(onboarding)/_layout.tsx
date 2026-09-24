import { Stack } from "expo-router";

import { PROFILE } from "@/screens/profile/theme";

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        // The progress bar lives in the native header title and Back is a
        // real toolbar item, so the header is on but transparent — the warm
        // backdrop runs edge to edge behind it. The automatic back is
        // suppressed so it doesn't sit beside the toolbar chevron.
        headerShown: true,
        headerTransparent: true,
        headerTitle: "",
        headerShadowVisible: false,
        headerBackVisible: false,
        headerTintColor: PROFILE.ink,
        contentStyle: { backgroundColor: PROFILE.background },
        animation: "none",
      }}
    />
  );
}
