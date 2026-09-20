import { memo, useMemo } from "react";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { generateBlob } from "@shapesoup/core";

/**
 * A decorative organic blob whose silhouette is generated procedurally by
 * `@shapesoup/core` (pure TS, deterministic from a seed) and then revealed by
 * the screen transition.
 *
 * Geometry is generated once per seed — never per frame. Only the opacity
 * shared value changes over time, so the SVG path string stays stable.
 */
export interface OrganicBlobProps {
  seed: string | number;
  /** Rendered size in device points. */
  width: number;
  height: number;
  color: string;
  x: number;
  y: number;
  zIndex?: number;
  opacity?: number;
  initialScale?: number;
  initialRotation?: number;
  /** 0 -> 1 reveal driven by the screen transition. */
  revealProgress: SharedValue<number>;
  /** Overrides the zIndex prop if provided. */
}

export default memo(function OrganicBlob({
  seed,
  width,
  height,
  color,
  x,
  y,
  zIndex = 1,
  opacity = 0.9,
  initialScale = 1,
  initialRotation = 0,
  revealProgress,
}: OrganicBlobProps) {
  const path = useMemo(() => {
    const { svg } = generateBlob({
      width,
      height,
      seed,
      complexity: 10,
      contrast: 0.35,
      colors: [color],
    });
    return /d="([^"]+)"/.exec(svg)?.[1] ?? "";
  }, [width, height, seed, color]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      revealProgress.value,
      [0.3, 0.85],
      [0, opacity],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          left: x,
          top: y,
          width,
          height,
          zIndex,
          transform: [{ rotate: `${initialRotation}deg` }, { scale: initialScale }],
        },
        animatedStyle,
      ]}
    >
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Path d={path} fill={color} />
      </Svg>
    </Animated.View>
  );
});
