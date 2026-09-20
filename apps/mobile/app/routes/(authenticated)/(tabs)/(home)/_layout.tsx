import React from "react";
import { Stack } from "expo-router";
import { defaultHeaderConfig } from "../header-constant";

const Layout = () => {
  return (
    <Stack screenOptions={{ ...defaultHeaderConfig, headerTitle: "Home" }}>
      {/* No header: the orange hero is the header, and it runs edge to edge
          behind the status bar. The screen pads itself past the safe area. */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      {/* TEMP: mascot state machine harness. */}
      <Stack.Screen
        name="mascot-lab"
        options={{
          headerTitle: "Mascot",
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      <Stack.Screen
        name="screen-2"
        options={{
          // headerLargeTitleEnabled: false,
          headerTitle: "Screen-2",
          headerBackButtonDisplayMode: "minimal",
          // headerTransparent: true,
        }}
      />
    </Stack>
  );
};

export default Layout;
