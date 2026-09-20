import React from "react";
import { useColorScheme } from "react-native";
import { Stack } from "expo-router";

import { dailyTheme } from "@/screens/daily-practice/theme";

/**
 * Beside `(tabs)`, not inside it — same shape as Discover.
 *
 * Every screen here uses the real native header, so back is the system chevron
 * with its swipe-back gesture rather than a drawn button that behaves almost
 * like one. The header is transparent — each screen pads its own content past
 * it (see HEADER_INSET in theme.ts), which is what keeps the warm background
 * running edge to edge behind the chevron.
 */
const DailyPracticeLayout = () => {
  const theme = dailyTheme(useColorScheme() === "dark");

  return (
    <Stack
      screenOptions={{
        headerTransparent: true,
        headerTitle: "",
        headerShadowVisible: false,
        headerBackButtonDisplayMode: "minimal",
        headerTintColor: theme.ink,
        contentStyle: { backgroundColor: theme.bg },
      }}
    >
      {/* The screen draws its own "Daily Practice" heading, so the header is
          just the chrome that carries the back chevron. */}
      <Stack.Screen name="index" options={{ title: "Daily Practice" }} />
      {/* Back returns to the intro; the line counter lives in the toolbar. */}
      <Stack.Screen name="practice" options={{ title: "Practice" }} />
      {/* Reached with `replace`, so the stack is [index, complete]: back returns
          to the intro, and the toolbar cross dismisses the whole flow. */}
      <Stack.Screen name="complete" options={{ title: "Complete" }} />
      {/* A real iOS modal — a card that slides up over the stack with the
          system's own dismiss gesture — rather than a sheet component rendered
          inside the screen. `presentation: "modal"` is what makes it one. */}
      <Stack.Screen
        name="framework"
        options={{
          title: "Framework",
          presentation: "modal",
          headerShown: false,
          contentStyle: { backgroundColor: "transparent" },
        }}
      />
    </Stack>
  );
};

export default DailyPracticeLayout;
