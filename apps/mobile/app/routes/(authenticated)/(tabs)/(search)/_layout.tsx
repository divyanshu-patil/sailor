import React from "react";
import { Stack } from "expo-router";

const Layout = () => {
  return (
    <Stack
      screenOptions={{
        headerTitle: "Search",
        headerTransparent: true,
      }}
    />
  );
};

export default Layout;
