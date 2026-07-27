import { useEffect } from "react";
import {
  cancelAnimation,
  Easing,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

export function useFloatingValue(
  initial: number,
  min: number,
  max: number,
  minDuration: number,
  maxDuration: number,
  speed: number,
  /** When false the value stops where it is instead of drifting on. */
  enabled = true,
) {
  const value = useSharedValue(initial);

  useEffect(() => {
    if (!enabled) {
      cancelAnimation(value);
      return;
    }

    function animate() {
      "worklet";
      const next = min + Math.random() * (max - min);
      // speed scales duration inversely: higher speed = shorter duration
      const duration =
        (minDuration + Math.random() * (maxDuration - minDuration)) / speed;
      value.value = withTiming(
        next,
        { duration, easing: Easing.inOut(Easing.sin) },
        (finished) => {
          if (finished) animate();
        },
      );
    }
    animate();

    return () => cancelAnimation(value);
  }, [enabled, max, maxDuration, min, minDuration, speed, value]);

  return value;
}
