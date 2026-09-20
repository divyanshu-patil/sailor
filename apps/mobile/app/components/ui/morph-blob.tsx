import { useEffect, useMemo } from "react";
import { StyleProp, ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { generateBlob } from "@shapesoup/core";

const AnimatedPath = Animated.createAnimatedComponent(Path);

const NUMBER = /-?\d*\.?\d+(?:e-?\d+)?/g;

/** Two shapesoup blobs at the same complexity share one command structure —
 *  only the numbers differ — which is what makes them tweenable. */
function blobNumbers(seed: string, width: number, height: number) {
  const { svg } = generateBlob({
    width,
    height,
    seed,
    complexity: 7,
    contrast: 0.4,
    colors: ["#000"],
  });
  const d = /d="([^"]+)"/.exec(svg)?.[1] ?? "";
  return {
    parts: d.split(NUMBER),
    numbers: (d.match(NUMBER) ?? []).map(Number),
  };
}

interface MorphBlobProps {
  seed: string;
  width: number;
  height: number;
  color: string;
  opacity?: number;
  /** One full A → B → A breath, in ms. */
  period?: number;
  /** How far it wanders while it breathes, in points. */
  drift?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * A pastel blob that slowly changes shape and floats.
 *
 * The silhouette tweens between two seeded shapesoup blobs on the UI thread;
 * the JS thread only builds the two number arrays, once.
 */
export function MorphBlob({
  seed,
  width,
  height,
  color,
  opacity = 1,
  period = 9000,
  drift = 10,
  style,
}: MorphBlobProps) {
  const { parts, from, to } = useMemo(() => {
    const a = blobNumbers(`${seed}-a`, width, height);
    const b = blobNumbers(`${seed}-b`, width, height);
    return { parts: a.parts, from: a.numbers, to: b.numbers };
  }, [seed, width, height]);

  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withDelay(
      // Desynchronise siblings so they don't all inhale together.
      (seed.length * 997) % 1500,
      withRepeat(
        withTiming(1, {
          duration: period / 2,
          easing: Easing.inOut(Easing.sin),
        }),
        -1,
        true,
      ),
    );
  }, [period, seed, t]);

  const animatedProps = useAnimatedProps(() => {
    let d = parts[0];
    for (let i = 0; i < from.length; i++) {
      d += (from[i] + (to[i] - from[i]) * t.value).toFixed(1) + parts[i + 1];
    }
    return { d };
  });

  const float = useAnimatedStyle(() => ({
    transform: [
      { translateX: (t.value - 0.5) * drift },
      { translateY: (0.5 - t.value) * drift * 0.8 },
      { rotate: `${(t.value - 0.5) * 6}deg` },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", width, height, opacity }, style, float]}
    >
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <AnimatedPath animatedProps={animatedProps} fill={color} />
      </Svg>
    </Animated.View>
  );
}
