import React from "react";
import { Stack } from "expo-router";

/**
 * Beside `(tabs)`, not inside it — same shape as Discover.
 *
 * Daily practice is reached from a card on the home screen, from a widget tap
 * and from the reminder notification, and it is a thing you finish and leave.
 * A tab would make it a place you live, and the deep link `sailor://daily-practice`
 * resolves to this route only because it isn't buried under a tab group.
 */
const DailyPracticeLayout = () => (
  <Stack
    screenOptions={{
      headerTransparent: true,
      headerLargeTitleEnabled: false,
      headerBackButtonDisplayMode: "minimal",
    }}
  >
    <Stack.Screen name="index" options={{ headerTitle: "Today" }} />
  </Stack>
);

export default DailyPracticeLayout;
