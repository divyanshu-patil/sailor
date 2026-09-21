import React from "react";
import { Stack } from "expo-router";

const Layout = () => {
  return (
    <Stack
      screenOptions={{
        title: "Search",
        headerTitle: "Search",
        headerTransparent: true,
      }}
    />
  );
};

export default Layout;
