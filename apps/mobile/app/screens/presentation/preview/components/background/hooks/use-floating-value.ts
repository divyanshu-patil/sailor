import { useEffect } from "react";
import { Easing, useSharedValue, withTiming } from "react-native-reanimated";

export function useFloatingValue(
  initial: number,
  min: number,
  max: number,
  minDuration: number,
  maxDuration: number,
  speed: number,
) {
  const value = useSharedValue(initial);

  useEffect(() => {
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
  }, [max, maxDuration, min, minDuration, speed, value]);

  return value;
}
