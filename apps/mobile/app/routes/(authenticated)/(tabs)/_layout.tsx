import { View, Text } from "react-native";
import React from "react";
import { NativeTabs } from "expo-router/unstable-native-tabs";

const Layout = () => {
  return (
    <NativeTabs
      minimizeBehavior="onScrollDown"
      // hidden={true}
    >
      <NativeTabs.Trigger name="(home)">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house" md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(explore)">
        <NativeTabs.Trigger.Label>Explore</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="safari" md="home" />
      </NativeTabs.Trigger>
      {/* <NativeTabs.Trigger name="(profile)">
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person" md="home" />
      </NativeTabs.Trigger> */}
      <NativeTabs.Trigger role="search" name="(search)">
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="home" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
};

export default Layout;
