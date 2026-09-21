import React from "react";
import { Stack } from "expo-router";
import { defaultHeaderConfig } from "../header-constant";

const Layout = () => {
  return (
    <Stack
      screenOptions={{
        ...defaultHeaderConfig,
        title: "Profile",
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
          title: "Edit Profile",
          headerTitle: "Edit Profile",
        }}
      />
      <Stack.Screen
        name="settings"
        options={{
          presentation: "modal",
          title: "Settings",
          headerTitle: "Settings",
        }}
      />
      <Stack.Screen
        name="terms-of-service"
        options={{
          presentation: "modal",
          title: "Terms of Service",
          headerTitle: "Terms of Service",
        }}
      />
      <Stack.Screen
        name="privacy-policy"
        options={{
          presentation: "modal",
          title: "Privacy Policy",
          headerTitle: "Privacy Policy",
        }}
      />
    </Stack>
  );
};

export default Layout;
