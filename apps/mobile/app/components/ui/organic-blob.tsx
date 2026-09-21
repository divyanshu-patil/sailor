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
/** The square the silhouette is generated in. Arbitrary — the viewBox below
 *  rescales it to whatever the caller asked for. */
const GEN_SIZE = 100;

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
  /** Silhouette detail. The default is the auth screens' lumpy ground shapes;
   *  drop it towards 4-6 for a rounder blob that survives being clipped by a
   *  card edge without looking torn. */
  complexity?: number;
  /** How far the radius is allowed to vary between points, 0-1. */
  contrast?: number;
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
  complexity = 10,
  contrast = 0.35,
  revealProgress,
}: OrganicBlobProps) {
  /**
   * The silhouette, generated once per seed in a fixed square.
   *
   * `generateBlob` fits its shape to `min(width, height)` and centres it in
   * whatever is left over, so a 300x100 box produced a ~76pt blob with 110pt of
   * transparent padding either side — `width` moved the blob instead of
   * widening it, and `height` did the same vertically. Generating square and
   * stretching it below is what makes `width` and `height` mean horizontal and
   * vertical spread.
   *
   * The generator's own inset is deliberately kept: the shape fills about 76%
   * of `GEN_SIZE`, so it fills about 76% of the caller's box too. Trimming the
   * viewBox to the path's bounding box would make `width`/`height` exact, but
   * it would also grow every existing square caller (the four auth screens) by
   * a third, which is not a change this was asked to make.
   */
  const path = useMemo(() => {
    const { svg } = generateBlob({
      width: GEN_SIZE,
      height: GEN_SIZE,
      seed,
      complexity,
      contrast,
      colors: [color],
    });
    return /d="([^"]+)"/.exec(svg)?.[1] ?? "";
  }, [seed, color, complexity, contrast]);

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
          transform: [
            { rotate: `${initialRotation}deg` },
            { scale: initialScale },
          ],
        },
        animatedStyle,
      ]}
    >
      {/* `none`: the box is the shape's size, so the two axes stretch
          independently. With the default the blob would letterbox and `width`
          would stop meaning width again the moment the box was not square. */}
      {/* `none` is the whole fix: the generation square stretches to the
          caller's box, so the two axes scale independently. With the default it
          letterboxes and `width` stops meaning width the moment the box is not
          square. */}
      <Svg
        width={width}
        height={height}
        viewBox={`0 0 ${GEN_SIZE} ${GEN_SIZE}`}
        preserveAspectRatio="none"
      >
        <Path d={path} fill={color} />
      </Svg>
    </Animated.View>
  );
});
