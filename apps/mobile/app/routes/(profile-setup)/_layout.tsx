import { Stack } from "expo-router";

export default function ProfileSetupLayout() {
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
