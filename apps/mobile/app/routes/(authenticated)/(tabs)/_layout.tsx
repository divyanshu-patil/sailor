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
      <NativeTabs.Trigger name="(decks)">
        <NativeTabs.Trigger.Label>Decks</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf="rectangle.portrait.on.rectangle.portrait.angled"
          md="home"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(profile)">
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person" md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger role="search" name="(search)">
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="home" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
};

export default Layout;
