import { StyleSheet, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useEffect, useRef } from "react";

const MAX_HEIGHT = 36;
const MIN_HEIGHT = 12;

const getRandomDuration = () => Math.random() * 300 + 200;
const getRandomHeight = () =>
  Math.random() * (MAX_HEIGHT - MIN_HEIGHT) + MIN_HEIGHT;

interface WaveFormProps {
  paused?: boolean;
}

const WaveForm = ({ paused = false }: WaveFormProps) => {
  return (
    <View style={styles.waveform}>
      {Array.from({ length: 12 }).map((_, i) => (
        <WaveItem key={i} paused={paused} />
      ))}
    </View>
  );
};

interface WaveItemProps {
  paused: boolean;
}

const WaveItem = ({ paused }: WaveItemProps) => {
  const height = useSharedValue(getRandomHeight());
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPausedRef = useRef(paused);

  useEffect(() => {
    isPausedRef.current = paused;

    if (paused) {
      // Cancel pending timeout and animate to min
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      height.value = withTiming(MIN_HEIGHT, {
        duration: 300,
        easing: Easing.inOut(Easing.ease),
      });
      return;
    }

    // Resume — restart the loop
    const animate = () => {
      if (isPausedRef.current) return; // guard if paused mid-schedule

      height.value = withSequence(
        withTiming(getRandomHeight(), {
          duration: getRandomDuration(),
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(getRandomHeight(), {
          duration: getRandomDuration(),
          easing: Easing.inOut(Easing.ease),
        }),
      );

      const totalDuration = getRandomDuration() + getRandomDuration();
      timeoutRef.current = setTimeout(animate, totalDuration);
    };

    const staggerDelay = Math.random() * 400;
    timeoutRef.current = setTimeout(animate, staggerDelay);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [height, paused]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: height.value,
  }));

  return <Animated.View style={[styles.waveItem, animatedStyle]} />;
};

export default WaveForm;

const styles = StyleSheet.create({
  waveform: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flex: 1,
  },
  waveItem: {
    width: 8,
    backgroundColor: "white",
    borderRadius: 100,
  },
});
