import { Stack } from "expo-router";
import { View } from "react-native";

import MascotPreloader from "@/components/ui/mascot-preloader";
import { AUTH_PRELOAD } from "@/constants/mascots";

export default function UnauthenticatedLayout() {
  return (
    <View style={{ flex: 1 }}>
      {/* Loads every auth-flow mascot into lib/dotlottie's cache up front.
          A no-op when the root layout already started them under the splash;
          this covers arriving here later, e.g. after signing out. */}
      <MascotPreloader sources={AUTH_PRELOAD} />

      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        {/* Email sign-up is a native sheet that fits its content, so it
            resizes as its steps swap: email, password, code. */}
        <Stack.Screen
          name="email-signup"
          options={{
            presentation: "formSheet",
            sheetAllowedDetents: "fitToContents",
            sheetGrabberVisible: true,
            contentStyle: { backgroundColor: "#FBF3EA" },
          }}
        />
      </Stack>
    </View>
  );
}
