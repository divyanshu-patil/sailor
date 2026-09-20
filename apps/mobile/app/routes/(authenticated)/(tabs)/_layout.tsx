import React from "react";
import { NativeTabs } from "expo-router/unstable-native-tabs";

import { homeColors } from "@/screens/home/theme";

/**
 * The tab bar, in the home screen's yellow.
 *
 * Both colours come from `homeColors` rather than being typed in here: the bar
 * sits directly under the home screen and picked up its hero orange the moment
 * that was tuned, which is the point of taking them from the same place.
 *
 * `hero` is the bar's own tint — the selected tab and its label. The unselected
 * ones stay the platform's grey: a second yellow at reduced alpha on a yellow
 * bar is not a state, it is a smudge.
 */
const Layout = () => {
  return (
    <NativeTabs
      minimizeBehavior="onScrollDown"
      tintColor={homeColors.tabTint}
      backgroundColor={homeColors.tabBar}
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
