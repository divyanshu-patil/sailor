import { Stack } from "expo-router";

export default function OnboardingSetupLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
        animation: "fade",
      }}
    />
  );
}
