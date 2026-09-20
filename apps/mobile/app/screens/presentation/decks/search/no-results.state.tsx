import React from "react";
import { StyleSheet, Text } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { EmptyState } from "@/screens/discover/components/empty-state";
import { dailyFonts } from "@/screens/daily-practice/theme";

/** The same character, glass dropped, nothing found. */
const NoResultsFoundState = ({ query }: { query: string }) => (
  <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.screen}>
    <EmptyState
      kind="noResults"
      title="Nothing here yet"
      description={
        <>
          We couldn&apos;t find any scripts for{" "}
          <Text style={styles.query}>“{query.trim()}”</Text>.
        </>
      }
    />
  </Animated.View>
);

export default NoResultsFoundState;

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: "center", paddingBottom: 60 },
  query: { fontFamily: dailyFonts.semibold, color: "#7C6BD9" },
});
