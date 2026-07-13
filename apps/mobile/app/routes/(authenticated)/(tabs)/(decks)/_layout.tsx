import React from "react";
import { Stack } from "expo-router";

const Layout = () => {
  return (
    <Stack
      screenOptions={{
        headerTitle: "Decks",
        headerLargeTitleEnabled: false,
        headerTransparent: true,
        // headerShown: false,
      }}
    />
  );
};

export default Layout;
