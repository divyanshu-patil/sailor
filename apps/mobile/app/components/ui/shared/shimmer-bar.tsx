import { LinearGradient } from "expo-linear-gradient";
import { useEffect } from "react";
import { ColorValue, StyleSheet, View } from "react-native";
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
}: {
  height: number;
  color: ColorValue;
  highlightColor?: ColorValue;
}) => {
  const translateX = useSharedValue(-1);

  useEffect(() => {
    translateX.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.linear }),
      -1,
      false,
    );
  }, [translateX]);

  const gradientStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value * 200 }],
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
      style={{ height, backgroundColor: color, overflow: "hidden" }}
    >
      <Animated.View style={[StyleSheet.absoluteFill, gradientStyle]}>
        <LinearGradient
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          colors={[color, color, highlightColor, color, color]}
          locations={[0, 0.35, 0.5, 0.65, 1]}
        />
      </Animated.View>
    </Animated.View>
  );
};

export default ShimmerBar;
