import React from "react";
import { Stack } from "expo-router";

/**
 * Discover sits beside `(tabs)` in the authenticated stack, not inside it.
 *
 * Pushing this group covers the tab bar, which is the point: browsing other
 * people's decks is a mode you enter and leave, and the tab bar would otherwise
 * sit directly under the floating search toolbar this screen puts at the bottom.
 */
const DiscoverLayout = () => (
  <Stack
    screenOptions={{
      headerTransparent: true,
      headerLargeTitleEnabled: true,
      headerBackButtonDisplayMode: "minimal",
    }}
  >
    <Stack.Screen name="index" options={{ headerTitle: "Discover" }} />
    <Stack.Screen name="saved" options={{ headerTitle: "Saved" }} />
    {/* Header stays (transparent) rather than hidden: the native back button
        is the only affordance out of a public deck, and the screen scrolls
        under it. */}
    <Stack.Screen name="[id]" options={{ headerTitle: "" }} />
  </Stack>
);

export default DiscoverLayout;
