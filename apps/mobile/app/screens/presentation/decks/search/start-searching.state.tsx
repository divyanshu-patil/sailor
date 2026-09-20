import React from "react";
import { StyleSheet } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { EmptyState } from "@/screens/discover/components/empty-state";

/** Before anything is typed: the mint searcher, glass up, ready to look. */
const StartSearchingState = () => (
  <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.screen}>
    <EmptyState
      kind="search"
      title="Start searching"
      description="Search for scripts, topics, or anything you want to practise."
    />
  </Animated.View>
);

export default StartSearchingState;

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: "center", paddingBottom: 60 },
});
