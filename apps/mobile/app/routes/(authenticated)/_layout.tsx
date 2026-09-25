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
          // A named default, so a screen added here without options shows
          // something readable instead of its folder name.
          title: "Sailors",
        }}
      >
        {/* Every screen carries an explicit `title`. With headers hidden here
            it is not drawn, but it is still what a child stack's back chevron
            and any system UI read — and the fallback is the raw segment, which
            is how "(tabs)" ended up on screen. */}
        <Stack.Screen name="(tabs)" options={{ title: "Sailors" }} />
        {/* Shown once, right after a sign-in, to anyone without Pro. Entered
            by replace, so there is nothing behind it to swipe back to. */}
        <Stack.Screen
          name="sailors-pro"
          options={{
            title: "Sailors Pro",
            animation: "fade",
            gestureEnabled: false,
          }}
        />
        <Stack.Screen name="(script)" options={{ title: "Scripts" }} />
        {/* Sibling of (tabs), not a child: pushing Discover covers the tab bar,
            which is what keeps its floating bottom search toolbar from landing
            on top of the tabs. */}
        <Stack.Screen name="discover" options={{ title: "Discover" }} />
        {/* Also a sibling of (tabs): daily practice is entered from the home
            screen, a widget and a notification, and left again. See its layout. */}
        <Stack.Screen
          name="daily-practice"
          options={{ title: "Daily Practice" }}
        />
        {/* A sibling of (tabs), like discover and daily-practice: pushing it
            covers the tab bar. Deciding whether to cancel is not a place to
            be offered four other tabs, and the illustration needs the whole
            screen. The header is the system's, transparent, so the back
            chevron and the swipe-back gesture are the native ones. */}
        <Stack.Screen
          name="cancel-subscription"
          options={{
            title: "Cancel Subscription",
            headerShown: true,
            headerTransparent: true,
            headerTitle: "",
            headerShadowVisible: false,
            headerBackButtonDisplayMode: "minimal",
            headerTintColor: "#141414",
          }}
        />
        {/* Its own screen rather than a modal: the reveal animation runs edge
            to edge and a sheet's inset corners would crop it. The header is
            transparent so the expanding circle passes under the chevron. */}
        <Stack.Screen
          name="streak-restore"
          options={{
            title: "Restore Streak",
            // Transparent, not hidden: the back chevron stays the system's, so
            // the swipe-back gesture still works, and the screen's background
            // — including the disc as it grows — runs underneath it.
            headerShown: true,
            headerTransparent: true,
            headerTitle: "",
            headerShadowVisible: false,
            headerBackButtonDisplayMode: "minimal",
            headerTintColor: "#141414",
          }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}
