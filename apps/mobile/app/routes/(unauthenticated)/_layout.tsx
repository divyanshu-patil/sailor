import { Stack } from "expo-router";

export default function UnauthenticatedLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}
