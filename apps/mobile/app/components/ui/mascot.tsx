import { useEffect, useMemo } from "react";
import { Canvas, Group, Skia, Skottie } from "@shopify/react-native-skia";
import {
  Easing,
  cancelAnimation,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import source from "./mascot-source";

/**
 * The mascot, rendered by Skia rather than a native Lottie view.
 *
 * The composition is parsed once for the whole app and shared: `Skottie.Make`
 * takes a few milliseconds on a 100KB file, and paying that on every mount is
 * what made a step change stutter. The frame counter is a shared value, so
 * playback never touches the JS thread.
 */
let composition: ReturnType<typeof Skia.Skottie.Make> | null = null;
const mascot = () => (composition ??= Skia.Skottie.Make(source));

interface MascotProps {
  /** Square side in points. */
  size: number;
  /** Off-screen copies hold their pose instead of burning frames. */
  playing?: boolean;
}

export default function Mascot({ size, playing = true }: MascotProps) {
  const animation = mascot();
  const frame = useSharedValue(0);

  useEffect(() => {
    if (!playing) {
      cancelAnimation(frame);
      return;
    }
    const seconds = animation.duration();
    frame.value = 0;
    frame.value = withRepeat(
      withTiming(seconds * animation.fps(), {
        duration: seconds * 1000,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
    return () => cancelAnimation(frame);
  }, [animation, frame, playing]);

  // Straight arithmetic on the size it was given. Measuring the canvas instead
  // (Skia's `onSize`) meant the scale — and with it where the drawing sat —
  // depended on a value that arrives a layout pass late and is worth nothing
  // here anyway: the canvas is a square of a known side, and the artwork is
  // centred in its own square, so scaling from the origin is all it takes.
  const transform = useMemo(
    () => [{ scale: size / animation.size().width }],
    [animation, size],
  );

  return (
    <Canvas style={{ width: size, height: size, alignSelf: "center" }}>
      <Group transform={transform}>
        <Skottie animation={animation} frame={frame} />
      </Group>
    </Canvas>
  );
}
