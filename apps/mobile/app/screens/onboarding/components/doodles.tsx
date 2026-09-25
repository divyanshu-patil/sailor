import { memo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { PROFILE } from "@/screens/profile/theme";

/** The two little strokes the mascots wear, as a standalone doodle. */
export const Ticks = memo(function Ticks({
  color,
  rotate = "0deg",
  size = 1,
}: {
  color: string;
  rotate?: string;
  size?: number;
}) {
  return (
    <View
      style={{
        width: 34 * size,
        height: 30 * size,
        transform: [{ rotate }],
      }}
    >
      <View
        style={[
          styles.tick,
          {
            backgroundColor: color,
            left: 0,
            top: 10 * size,
            width: 20 * size,
            height: 5.5 * size,
            transform: [{ rotate: "18deg" }],
          },
        ]}
      />
      <View
        style={[
          styles.tick,
          {
            backgroundColor: color,
            left: 16 * size,
            top: 0,
            width: 16 * size,
            height: 5.5 * size,
            transform: [{ rotate: "62deg" }],
          },
        ]}
      />
    </View>
  );
});

/** A hand-drawn arrow that curls down and ends pointing right. Mirror it with
 *  `flip` for one that ends pointing left. */
export const CurlArrow = memo(function CurlArrow({
  width = 52,
  color = PROFILE.muted,
  flip,
  rotate = "0deg",
}: {
  width?: number;
  color?: string;
  flip?: boolean;
  rotate?: string;
}) {
  return (
    <Svg
      width={width}
      height={width * (44 / 52)}
      viewBox="0 0 52 44"
      style={{ transform: [{ rotate }, ...(flip ? [{ scaleX: -1 }] : [])] }}
    >
      <Path
        d="M 6 4 C 2 26, 18 40, 44 32 M 44 32 L 33 26 M 44 32 L 36 42"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
});

/** An outlined heart, drawn thick like a marker. */
export const HeartOutline = memo(function HeartOutline({
  size = 30,
  color,
}: {
  size?: number;
  color: string;
}) {
  return (
    <Svg width={size} height={size * (28 / 30)} viewBox="0 0 30 28">
      <Path
        d="M 15 25 C 6 18, 2.5 13, 2.5 8.5 C 2.5 5, 5.2 2.5 8.5 2.5 C 11.2 2.5 13.6 4.3 15 6.8 C 16.4 4.3 18.8 2.5 21.5 2.5 C 24.8 2.5 27.5 5 27.5 8.5 C 27.5 13 24 18 15 25 Z"
        stroke={color}
        strokeWidth={3.4}
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
});

const styles = StyleSheet.create({
  tick: {
    position: "absolute",
    borderRadius: 3,
  },
});
