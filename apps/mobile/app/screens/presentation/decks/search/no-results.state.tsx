import { StyleSheet } from "react-native";
import React from "react";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { Image } from "expo-image";

/** Same sizing fix as start-searching.state — see the note there. */
const NoResultsFoundState = ({ query }: { query: string }) => {
  return (
    <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.screen}>
      <Image
        source={require("@/assets/no-results.png")}
        style={styles.art}
        contentFit="contain"
        transition={200}
        accessibilityLabel={`No decks match ${query}`}
      />
    </Animated.View>
  );
};

export default NoResultsFoundState;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  art: { width: "100%", height: "100%" },
});
