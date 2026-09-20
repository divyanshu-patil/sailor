import { memo, useMemo } from "react";
import { StyleSheet } from "react-native";
import { Canvas, Group, Path, RoundedRect, Skia } from "@shopify/react-native-skia";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import { generateBlob } from "@shapesoup/core";

import { PROFILE_PASTELS } from "../theme";

interface Blob {
  seed: string;
  /** Top-left of the blob's bounding box, in points (may be negative). */
  x: number;
  y: number;
  size: number;
  color: string;
  opacity: number;
}

const buildPath = (seed: string, size: number) => {
  const { svg } = generateBlob({
    width: size,
    height: size,
    seed,
    complexity: 9,
    contrast: 0.35,
    colors: ["#000"],
  });
  const d = /d="([^"]+)"/.exec(svg)?.[1] ?? "";
  return Skia.Path.MakeFromSVGString(d);
};

interface ProfileBackgroundProps {
  width: number;
  height: number;
  /**
   * Vertical offset applied to every shape, so they keep their relationship to
   * the header while the canvas itself stays anchored to the screen top (any
   * clip then happens at the screen edge, not across the view).
   */
  offsetY?: number;
  entrance: SharedValue<number>;
}

/**
 * The profile screen's decorative layer: soft pastel blobs, a couple of
 * handwritten-style strokes. It is a fixed backdrop — rendered behind the
 * scroll view, not inside it — so the shapes hold still while the content
 * scrolls over them instead of cropping at the canvas edge.
 *
 * Everything lives in a single Skia canvas rather than a stack of views, and is
 * generated once from a seed — only the reveal opacity/scale is animated, so no
 * path is rebuilt per frame. Purely decorative: `pointerEvents="none"` keeps it
 * out of the touch tree and off the accessibility tree.
 */
const ProfileBackground = memo(function ProfileBackground({
  width,
  height,
  offsetY = 0,
  entrance,
}: ProfileBackgroundProps) {
  const blobs = useMemo<Blob[]>(
    () => [
      {
        seed: "profile-yellow",
        x: width * 0.5,
        y: offsetY - width * 0.42,
        size: width * 1.05,
        color: PROFILE_PASTELS.yellow,
        opacity: 0.75,
      },
      {
        seed: "profile-pink",
        x: -width * 0.5,
        y: offsetY + width * 0.28,
        size: width * 1.05,
        color: PROFILE_PASTELS.pink,
        opacity: 0.6,
      },
      {
        seed: "profile-blue",
        x: width * 0.5,
        y: offsetY + width * 0.62,
        size: width * 0.85,
        color: PROFILE_PASTELS.blue,
        opacity: 0.6,
      },
      {
        seed: "profile-mint",
        x: -width * 0.35,
        y: offsetY + width * 0.95,
        size: width * 0.7,
        color: PROFILE_PASTELS.mint,
        opacity: 0.5,
      },
    ],
    [width, offsetY],
  );

  const paths = useMemo(
    () => blobs.map((blob) => buildPath(blob.seed, blob.size)),
    [blobs],
  );

  // Three little "spark" dashes by the avatar, like the reference's accent.
  const dashes = useMemo(
    () => [
      { x: width * 0.68, y: offsetY + width * 0.2, angle: 12 },
      { x: width * 0.76, y: offsetY + width * 0.22, angle: 24 },
      { x: width * 0.83, y: offsetY + width * 0.27, angle: 38 },
    ],
    [width, offsetY],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      entrance.value,
      [0, 0.55],
      [0, 1],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        scale: interpolate(
          entrance.value,
          [0, 0.55],
          [0.94, 1],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.container, { height }, animatedStyle]}
    >
      <Canvas style={{ width, height }}>
        {blobs.map((blob, index) => (
          <Group
            key={blob.seed}
            transform={[{ translateX: blob.x }, { translateY: blob.y }]}
            opacity={blob.opacity}
          >
            {paths[index] ? (
              <Path path={paths[index]} color={blob.color} />
            ) : null}
          </Group>
        ))}

        {dashes.map((dash, index) => (
          <Group
            key={`dash-${index}`}
            transform={[
              { translateX: dash.x },
              { translateY: dash.y },
              { rotate: (dash.angle * Math.PI) / 180 },
              { translateX: -dash.x },
              { translateY: -dash.y },
            ]}
          >
            <RoundedRect
              x={dash.x}
              y={dash.y}
              width={4}
              height={16}
              r={2}
              color="#F4CF66"
            />
          </Group>
        ))}
      </Canvas>
    </Animated.View>
  );
});

export default ProfileBackground;

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
  },
});
