import { View, Text } from "react-native";
import React from "react";
import { Stack } from "expo-router";
import { defaultHeaderConfig } from "../header-constant";

const Layout = () => {
  return (
    <Stack screenOptions={{ ...defaultHeaderConfig, headerTitle: "Home" }}>
      <Stack.Screen name="index" />
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
