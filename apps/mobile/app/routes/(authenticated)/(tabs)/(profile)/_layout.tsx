import React from "react";
import { Stack } from "expo-router";
import { defaultHeaderConfig } from "../header-constant";

const Layout = () => {
  return (
    <Stack
      screenOptions={{
        ...defaultHeaderConfig,
        headerTitle: "",
        headerLargeTitleEnabled: false,
        headerTransparent: true,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen
        name="edit-profile"
        options={{
          presentation: "modal",
          headerTitle: "Edit Profile",
        }}
      />
      <Stack.Screen
        name="settings"
        options={{
          presentation: "modal",
          headerTitle: "Settings",
        }}
      />
      <Stack.Screen
        name="terms-of-service"
        options={{
          presentation: "modal",
          headerTitle: "Terms of Service",
        }}
      />
      <Stack.Screen
        name="privacy-policy"
        options={{
          presentation: "modal",
          headerTitle: "Privacy Policy",
        }}
      />
    </Stack>
  );
};

export default Layout;
