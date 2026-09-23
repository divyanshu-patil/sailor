import { Stack } from "expo-router";

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // A normal stack: the system back gesture walks the steps in reverse.
        animation: "slide_from_right",
      }}
    />
  );
}
