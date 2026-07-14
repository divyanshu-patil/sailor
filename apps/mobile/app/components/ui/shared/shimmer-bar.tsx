import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { ColorValue, StyleSheet } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const ShimmerBar = ({
  height,
  color,
  highlightColor = "#fff",
  duration = 1800,
}: {
  height: number;
  color: ColorValue;
  highlightColor?: ColorValue;
  duration?: number;
}) => {
  const translateX = useSharedValue(0);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!width) return;

    // Start fully off-screen to the left, end fully off-screen to the right.
    translateX.value = -width;
    translateX.value = withRepeat(
      withTiming(width, { duration: duration, easing: Easing.linear }),
      -1,
      false,
    );
  }, [translateX, width, duration]);

  const gradientStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const customHeightEntering = () => {
    "worklet";
    return {
      initialValues: { height: 0 },
      animations: { height: withSpring(height, { damping: 50 }) },
    };
  };

  const customHeightExiting = () => {
    "worklet";
    return {
      initialValues: { height: height },
      animations: { height: withTiming(0, { duration: 150 }) },
    };
  };

  return (
    <Animated.View
      entering={customHeightEntering}
      exiting={customHeightExiting}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ height, backgroundColor: color, overflow: "hidden" }}
    >
      {width > 0 && (
        <Animated.View
          style={[StyleSheet.absoluteFill, { width }, gradientStyle]}
        >
          <LinearGradient
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            colors={[color, color, highlightColor, color, color]}
            locations={[0, 0.35, 0.5, 0.65, 1]}
          />
        </Animated.View>
      )}
    </Animated.View>
  );
};

export default ShimmerBar;
