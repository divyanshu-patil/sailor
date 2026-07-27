import React from "react";
import { StyleSheet, Dimensions } from "react-native";
import { Canvas } from "@shopify/react-native-skia";
import Animated, { LinearTransition } from "react-native-reanimated";
import BlobLayer, { BlobConfig } from "./blob-layer";

const { width, height } = Dimensions.get("window");

const BLOBS: BlobConfig[] = [
  { color: "#FFD4A3", r: 180, startX: width * 0.2, startY: height * 0.15 },
  { color: "#83c5be", r: 160, startX: width * 0.48, startY: height * 0.35 },
  { color: "#FF6F91", r: 150, startX: width * 0.15, startY: height * 0.65 },
  { color: "#B5A8FF", r: 170, startX: width * 0.75, startY: height * 0.75 },
  { color: "#FFF1C1", r: 140, startX: width * 0.5, startY: height * 0.9 },
];

interface BlobBackgroundProps {
  speed?: number;
  blur?: number;
  /** false leaves the blobs on screen but stops them drifting. */
  animate?: boolean;
}

const BlobBackground = ({
  speed = 2,
  blur = 150,
  animate = true,
}: BlobBackgroundProps) => {
  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { backgroundColor: "#FFF4E8" }]}
      layout={LinearTransition}
    >
      <Canvas style={StyleSheet.absoluteFill}>
        <BlobLayer
          blobs={BLOBS}
          width={width}
          height={height}
          speed={speed}
          blur={blur}
          animate={animate}
        />
      </Canvas>
    </Animated.View>
  );
};

export default BlobBackground;
