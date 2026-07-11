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
    </Stack>
  );
};

export default Layout;
