import { StyleSheet, Dimensions } from "react-native";
import React from "react";
import { Image } from "expo-image";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

const SCREEN_HEIGHT = Dimensions.get("screen").height;
const StartSearchingState = () => {
  return (
    <Animated.View
      entering={FadeIn}
      exiting={FadeOut}
      style={[styles.screen, styles.centered]}
    >
      <Image
        source={require("@/assets/start-search.png")}
        style={{ height: SCREEN_HEIGHT, aspectRatio: 9 / 16 }}
      />
    </Animated.View>
  );
};

export default StartSearchingState;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
});
