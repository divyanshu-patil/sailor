import { Stack } from "expo-router";
import { View } from "react-native";

import MascotPreloader from "@/components/ui/mascot-preloader";

export default function UnauthenticatedLayout() {
  return (
    <View style={{ flex: 1 }}>
      {/* Warms lottie-ios's shared animation cache for the whole auth flow.
          Mounted here rather than at the root so it lives exactly as long as
          the flow does: it goes away by itself once sign-in swaps this
          navigator out. */}
      <MascotPreloader />

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
            sheetCornerRadius: 32,
            contentStyle: { backgroundColor: "#FBF3EA" },
          }}
        />
      </Stack>
    </View>
  );
}
