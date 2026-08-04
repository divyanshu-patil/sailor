import { Canvas, Group, Path, Skia } from "@shopify/react-native-skia";
import { useEffect } from "react";
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

interface CircularProgressProps {
  /** 0..1. Undefined spins instead — the platform gave no total to measure
   *  against, and a made-up percentage would be a lie. */
  progress?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
}

/** Fraction of the ring the indeterminate arc covers. */
const SPINNER_SWEEP = 0.25;

/**
 * A determinate ring, drawn with Skia.
 *
 * Skia rather than a rotating-half-circle trick because the arc is the whole
 * point: a real sweep needs a real path, and `react-native-svg` isn't in this
 * project while Skia already is.
 */
export default function CircularProgress({
  progress,
  size = 28,
  strokeWidth = 3,
  color = "rgba(28,28,30,0.9)",
  trackColor = "rgba(28,28,30,0.18)",
}: CircularProgressProps) {
  const inset = strokeWidth / 2;
  const path = Skia.Path.Make();
  // Starts at -90° so the ring fills from twelve o'clock, the way every
  // progress ring the user has ever seen does.
  path.addArc(
    Skia.XYWHRect(inset, inset, size - strokeWidth, size - strokeWidth),
    -90,
    360,
  );

  const spin = useSharedValue(0);
  const indeterminate = progress == null;

  useEffect(() => {
    if (!indeterminate) {
      spin.value = 0;
      return;
    }
    spin.value = withRepeat(
      withTiming(2 * Math.PI, { duration: 900, easing: Easing.linear }),
      -1,
    );
  }, [indeterminate, spin]);

  const transform = useDerivedValue(() => [{ rotate: spin.value }]);
  const center = { x: size / 2, y: size / 2 };

  return (
    <Canvas style={{ width: size, height: size }}>
      <Path
        path={path}
        style="stroke"
        strokeWidth={strokeWidth}
        strokeCap="round"
        color={trackColor}
      />
      <Group origin={center} transform={transform}>
        <Path
          path={path}
          style="stroke"
          strokeWidth={strokeWidth}
          strokeCap="round"
          color={color}
          start={0}
          end={indeterminate ? SPINNER_SWEEP : Math.max(0.02, progress)}
        />
      </Group>
    </Canvas>
  );
}
