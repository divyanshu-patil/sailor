import { useEffect, useMemo } from "react";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { generateBlob } from "@shapesoup/core";

/**
 * A decorative organic blob whose silhouette is generated procedurally by
 * `@shapesoup/core` (pure TS, deterministic from a seed) and then moved with
 * Reanimated.
 *
 * Geometry is generated once per seed — never per frame. Only the transform
 * shared values change over time, so the SVG path string stays stable.
 *
 * Motion is a retarget loop that runs on the JS thread only every few seconds
 * (a `setTimeout`, not a per-frame loop): each cycle picks new random targets
 * and hands them to `withTiming`, which does the actual interpolation on the UI
 * thread. It is fully cleaned up on unmount.
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
  /** Enables the subtle random drift. */
  motion?: boolean;
  /** Stagger so blobs never retarget on the same beat. */
  motionDelay?: number;
  /** Max travel in points for the drift. */
  motionRange?: number;
  /** 0 -> 1 reveal driven by the screen transition. */
  revealProgress: SharedValue<number>;
  /** Overrides the zIndex prop if provided. */
}

export default function OrganicBlob({
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
  motion = false,
  motionDelay = 0,
  motionRange = 16,
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

  const scale = useSharedValue(initialScale);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotation = useSharedValue(initialRotation);

  useEffect(() => {
    if (!motion) return;

    let timer: ReturnType<typeof setTimeout>;

    const retarget = () => {
      const range = motionRange;
      const duration = 3200 + Math.random() * 1600;

      scale.value = withTiming(initialScale * (0.95 + Math.random() * 0.1), {
        duration: duration * 1.15,
        easing: Easing.inOut(Easing.sin),
      });
      translateX.value = withTiming((Math.random() - 0.5) * range, {
        duration,
        easing: Easing.inOut(Easing.sin),
      });
      translateY.value = withTiming((Math.random() - 0.5) * range, {
        duration: duration * 0.9,
        easing: Easing.inOut(Easing.sin),
      });
      rotation.value = withTiming(initialRotation + (Math.random() - 0.5) * 6, {
        duration: duration * 1.25,
        easing: Easing.inOut(Easing.sin),
      });

      timer = setTimeout(retarget, duration);
    };

    timer = setTimeout(retarget, motionDelay);

    return () => clearTimeout(timer);
  }, [
    motion,
    motionDelay,
    motionRange,
    initialRotation,
    initialScale,
    rotation,
    scale,
    translateX,
    translateY,
  ]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      revealProgress.value,
      [0.3, 0.85],
      [0, opacity],
      Extrapolation.CLAMP,
    ),
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotation.value}deg` },
      { scale: scale.value },
    ],
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
        },
        animatedStyle,
      ]}
    >
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Path d={path} fill={color} />
      </Svg>
    </Animated.View>
  );
}
