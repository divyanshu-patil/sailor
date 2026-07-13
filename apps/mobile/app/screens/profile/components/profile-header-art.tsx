import React from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import { Canvas, Oval } from "@shopify/react-native-skia";
import { Image } from "expo-image";

const SCREEN_WIDTH = Dimensions.get("screen").width;
const OVAL_WIDTH = SCREEN_WIDTH * 2;
const OVAL_HEIGHT = OVAL_WIDTH / 2;
const MASCOT_WIDTH = 250;

interface ProfileHeaderArtProps {
  backCircleColor: string;
}

/**
 * Purely decorative header art: the big Skia oval backdrop plus the
 * mascot floating in front of it. Owns nothing but its own visuals —
 * no color logic, no data.
 */
const ProfileHeaderArt = ({ backCircleColor }: ProfileHeaderArtProps) => {
  return (
    <>
      <View style={styles.canvasContainer}>
        <Canvas style={styles.canvas}>
          <Oval
            x={SCREEN_WIDTH / 2 - OVAL_WIDTH / 2}
            y={-OVAL_HEIGHT / 3}
            width={OVAL_WIDTH}
            height={OVAL_HEIGHT}
            color={backCircleColor}
          />
        </Canvas>
      </View>
      {/* NOTE: this file's location changed relative to /assets, so the
          require() path below uses the @ alias instead of the original
          "../../../assets/cloud_mascot.svg". Verify your babel module
          resolver rewrites require() (not just import) — if it doesn't,
          swap this back to a relative path. */}
      <Image
        source={require("@/assets/cloud_mascot.svg")}
        style={styles.mascot}
      />
    </>
  );
};

export default ProfileHeaderArt;

const styles = StyleSheet.create({
  canvasContainer: {
    width: "100%",
    height: OVAL_HEIGHT,
  },
  canvas: { flex: 1 },
  mascot: {
    width: MASCOT_WIDTH,
    aspectRatio: 1,
    position: "absolute",
    top: OVAL_HEIGHT / 4.5,
    left: SCREEN_WIDTH / 2 - MASCOT_WIDTH / 2,
    transform: [{ rotate: "15deg" }],
  },
});
