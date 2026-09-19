import { Canvas, Path, usePathValue } from "@shopify/react-native-skia";
import { memo, useMemo } from "react";
import { StyleProp, ViewStyle } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useDerivedValue,
  type SharedValue,
} from "react-native-reanimated";

/**
 * Skia version of the organic ground whose geometry is rebuilt on the UI
 * thread from a single `progress` shared value.
 *
 * Unlike the SVG `OrganicGround`, the crest height and the shoulder depth are
 * derived values, so the hill physically rises and reshapes instead of being
 * scaled. The path is constructed with the same cubic-bezier model:
 *
 *   M left-bottom
 *   L left-shoulder
 *   C ... smooth hill ...
 *   L right-bottom
 *   Z
 *
 * Coordinates are local to the canvas: `crestFrom`/`crestTo` are the y of the
 * hill top (0 = canvas top) at progress 0 and 1, `depthFrom`/`depthTo` are how
 * far the left/right shoulders sit below the crest.
 */
export interface AnimatedOrganicGroundProps {
  width: number;
  height: number;
  x: number;
  y: number;
  /** 0 = onboarding ground, 1 = create-account ground. */
  progress: SharedValue<number>;
  crestFrom: number;
  crestTo: number;
  depthFrom: number;
  depthTo: number;
  curveOffset?: number;
  fill?: string;
  zIndex?: number;
  style?: StyleProp<ViewStyle>;
}

export default memo(function AnimatedOrganicGround({
  width,
  height,
  x,
  y,
  progress,
  crestFrom,
  crestTo,
  depthFrom,
  depthTo,
  curveOffset = 0,
  fill = "#FFFFFF",
  zIndex,
  style,
}: AnimatedOrganicGroundProps) {
  // Horizontal centre of the crest and half-width of the rounded top.
  const crestX = width * (0.5 + curveOffset);
  const crestSpread = width * 0.1;

  const crest = useDerivedValue(() =>
    interpolate(
      progress.value,
      [0, 1],
      [crestFrom, crestTo],
      Extrapolation.CLAMP,
    ),
  );

  const depth = useDerivedValue(() =>
    interpolate(progress.value, [0, 1], [depthFrom, depthTo], Extrapolation.CLAMP),
  );

  const path = usePathValue((builder) => {
    "worklet";
    const bottom = height;
    const top = crest.value;
    const shoulder = top + depth.value;

    builder.moveTo(0, bottom);
    builder.lineTo(0, shoulder);
    builder.cubicTo(0, top, crestX - crestSpread, top, crestX, top);
    builder.cubicTo(crestX + crestSpread, top, width, top, width, shoulder);
    builder.lineTo(width, bottom);
    builder.close();
  });

  const canvasStyle = useMemo(
    () => ({ width, height }),
    [width, height],
  );

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: "absolute", left: x, top: y, width, height, zIndex },
        style,
      ]}
    >
      <Canvas style={canvasStyle}>
        <Path path={path} color={fill} />
      </Canvas>
    </Animated.View>
  );
});
