import { StyleSheet, Dimensions } from "react-native";
import React from "react";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { Image } from "expo-image";

const SCREEN_HEIGHT = Dimensions.get("screen").height;
const NoResultsFoundState = ({ query }: { query: string }) => {
  return (
    <Animated.View
      entering={FadeIn}
      exiting={FadeOut}
      style={[styles.screen, styles.centered]}
    >
      <Image
        source={require("@/assets/no-results.png")}
        style={{ height: SCREEN_HEIGHT, aspectRatio: 9 / 16 }}
      />
    </Animated.View>
  );
};

export default NoResultsFoundState;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  messageText: {
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
    color: "#3C3C43",
  },
});
