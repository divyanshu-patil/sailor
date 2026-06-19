import { View, Text } from "react-native";
import React from "react";
import { Stack } from "expo-router";
import { defaultHeaderConfig } from "../header-constant";

const Layout = () => {
  return (
    <Stack
      screenOptions={{
        ...defaultHeaderConfig,
        headerSearchBarOptions: {
          allowToolbarIntegration: true,
        },
        headerTitle: "Search",
      }}
    />
  );
};

export default Layout;
