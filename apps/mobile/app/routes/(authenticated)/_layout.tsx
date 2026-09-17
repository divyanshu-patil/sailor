import { useEffect } from "react";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { startGenerationLifecycleWatch } from "@/lib/generation-guard";

export default function AuthenticatedLayout() {
  // Mounted once, above every screen that can start a generation. Backgrounding
  // the app is the closest thing React Native reports to a quit, and it's one of
  // the two moments an in-flight script is actually cancelled — the other being
  // a return to the home tab. Backing out of the preview screen is deliberately
  // not one of them.
  useEffect(startGenerationLifecycleWatch, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(script)" />
        {/* Sibling of (tabs), not a child: pushing Discover covers the tab bar,
            which is what keeps its floating bottom search toolbar from landing
            on top of the tabs. */}
        <Stack.Screen name="discover" />
        {/* Also a sibling of (tabs): daily practice is entered from the home
            screen, a widget and a notification, and left again. See its layout. */}
        <Stack.Screen name="daily-practice" />
      </Stack>
    </GestureHandlerRootView>
  );
}
