import { StyleSheet, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useEffect } from "react";

const MAX_HEIGHT = 36;
const MIN_HEIGHT = 16;

const getRandomDuration = () => Math.random() * 300 + 200; // 200–500ms
const getRandomHeight = () =>
  Math.random() * (MAX_HEIGHT - MIN_HEIGHT) + MIN_HEIGHT;

const WaveForm = () => {
  return (
    <View style={styles.waveform}>
      {Array.from({ length: 12 }).map((_, i) => (
        <WaveItem key={i} />
      ))}
    </View>
  );
};

const WaveItem = () => {
  const height = useSharedValue(getRandomHeight());

  useEffect(() => {
    const animate = () => {
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
      // Schedule next animation when current finishes
      const totalDuration = getRandomDuration() + getRandomDuration();
      setTimeout(animate, totalDuration);
    };

    // Stagger start so bars don't all move together
    const staggerDelay = Math.random() * 400;
    const timeout = setTimeout(animate, staggerDelay);
    return () => clearTimeout(timeout);
  }, [height]);

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
