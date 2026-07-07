import { StyleSheet, ViewStyle } from "react-native";
import { AnimatedPressable } from "@/components/ui/animated/AnimatedComponents";
import { fonts } from "@/constants/fonts";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  Easing,
  LinearTransition,
} from "react-native-reanimated";
import FadeInDownText from "@/components/ui/text/fade-in-down";

interface CtaButtonProps {
  onPress?: () => void;
  children: string;
  containerStyles?: ViewStyle;
}

const EXIT_DURATION = 500;

const CtaButton = ({ children, onPress, containerStyles }: CtaButtonProps) => {
  const pressed = useSharedValue(0);
  const blurIntensity = useSharedValue(0);

  const pressStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: withSpring(pressed.value ? 0.95 : 1, { damping: 50 }) },
    ],
    borderRadius: withSpring(pressed.value ? 20 : 36),
  }));

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

  return (
    <Animated.View exiting={exiting} style={[styles.wrapper, containerStyles]}>
      <AnimatedPressable
        onPress={onPress}
        onPressIn={() => (pressed.value = 1)}
        onPressOut={() => (pressed.value = 0)}
        style={[styles.pressable, pressStyle]}
        layout={LinearTransition.springify()}
      >
        <FadeInDownText
          textStyle={styles.text}
          springConfig={{
            damping: 50,
          }}
        >
          {children}
        </FadeInDownText>
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
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 48,
    backgroundColor: "#313131",
    overflow: "hidden",
  },
  text: { color: "white", fontSize: 28, fontFamily: fonts.krona },
});
