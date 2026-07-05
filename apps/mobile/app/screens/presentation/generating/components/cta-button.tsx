/* eslint-disable react-hooks/immutability */
import { StyleSheet, ViewStyle } from "react-native";
import { useState } from "react";
import {
  AnimatedHost,
  AnimatedPressable,
} from "@/components/ui/animated/AnimatedComponents";
import { fonts } from "@/constants/fonts";
import Animated, {
  useAnimatedStyle,
  useAnimatedProps,
  useSharedValue,
  withSpring,
  withTiming,
  Easing,
  LinearTransition,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { Text } from "@expo/ui/swift-ui";
import {
  Animation,
  animation,
  contentTransition,
  font,
  foregroundStyle,
} from "@expo/ui/swift-ui/modifiers";

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

interface CtaButtonProps {
  onPress?: () => void;
  label?: string;
  children?: string;
  containerStyles?: ViewStyle;
}

const EXIT_DURATION = 350;

const CtaButton = ({
  label,
  children,
  onPress,
  containerStyles,
}: CtaButtonProps) => {
  const pressed = useSharedValue(0);
  const blurIntensity = useSharedValue(0);

  const pressStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: withSpring(pressed.value ? 0.95 : 1, { damping: 50 }) },
    ],
    borderRadius: withSpring(pressed.value ? 20 : 36),
  }));

  const blurAnimatedProps = useAnimatedProps(() => ({
    intensity: blurIntensity.value,
  }));

  // Custom "exiting" animation. Reanimated keeps the native view mounted
  // (as a snapshot) while this runs, so the blurIntensity shared value we
  // mutate here still drives the nested AnimatedBlurView's animated props.
  const exiting = () => {
    "worklet";
    blurIntensity.value = withTiming(40, {
      duration: EXIT_DURATION,
      easing: Easing.out(Easing.cubic),
    });

    return {
      initialValues: {
        opacity: 1,
        transform: [{ translateY: 0 }],
      },
      animations: {
        opacity: withTiming(0, {
          duration: EXIT_DURATION,
          easing: Easing.out(Easing.cubic),
        }),
        transform: [
          {
            translateY: withTiming(24, {
              duration: EXIT_DURATION,
              easing: Easing.out(Easing.cubic),
            }),
          },
        ],
      },
    };
  };

  const [labelTick, setLabelTick] = useState(0);

  const handleOnPress = () => {
    if ((label ?? children)?.toLowerCase() !== "stopped")
      setLabelTick((prev) => prev + 1);
    onPress?.();
  };

  return (
    <Animated.View exiting={exiting} style={[styles.wrapper, containerStyles]}>
      <AnimatedPressable
        onPress={handleOnPress}
        onPressIn={() => (pressed.value = 1)}
        onPressOut={() => (pressed.value = 0)}
        style={[styles.pressable, pressStyle]}
        layout={LinearTransition.springify()}
      >
        <AnimatedHost
          layout={LinearTransition.springify().damping(100)}
          matchContents
          modifiers={[animation(Animation.default, labelTick)]}
        >
          <Text
            modifiers={[
              foregroundStyle("#fff"),
              font({
                family: fonts.krona,
                size: 28,
              }),
              contentTransition("numericText", { countsDown: true }),
              animation(Animation.spring(), labelTick),
            ]}
          >
            {label ?? children}
          </Text>
        </AnimatedHost>
        <AnimatedBlurView
          animatedProps={blurAnimatedProps}
          tint="dark"
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      </AnimatedPressable>
    </Animated.View>
  );
};

export default CtaButton;

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: "flex-start",
  },
  pressable: {
    paddingVertical: 24,
    paddingHorizontal: 48,
    backgroundColor: "#313131",
    overflow: "hidden",
  },
  text: { color: "white", fontSize: 28, fontFamily: fonts.krona },
});
