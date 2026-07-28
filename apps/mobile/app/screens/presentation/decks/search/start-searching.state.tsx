import { StyleSheet } from "react-native";
import React from "react";
import { Image } from "expo-image";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

/**
 * The art was invisible because it was sized off the screen rather than off its
 * container: `height: SCREEN_HEIGHT` with `aspectRatio: 9/16` made it ~480pt wide
 * on a ~390pt screen, so it overflowed in both directions, and expo-image's
 * default `contentFit: "cover"` then cropped what was left down to a magnified
 * slice of the middle. The declared ratio was wrong too — the asset is 458x931,
 * which is 0.492, not 0.5625.
 *
 * Filling the container with `contain` removes the whole class of problem: the
 * image takes whatever space is actually available and keeps its own proportions
 * inside it, on any screen size, with no hardcoded ratio to drift out of sync
 * with the file.
 */
const StartSearchingState = () => {
  return (
    <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.screen}>
      <Image
        source={require("@/assets/start-search.png")}
        style={styles.art}
        contentFit="contain"
        transition={200}
      />
    </Animated.View>
  );
};

export default StartSearchingState;

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
