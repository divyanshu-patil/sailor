import { StyleSheet, Text } from "react-native";
import EntypoIcons from "@react-native-vector-icons/entypo";
import { colord } from "colord";
import {
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { AnimatedPressable } from "@/components/ui/animated/AnimatedComponents";

interface CtaButtonProps {
  onPress?: () => void;
  label: string;
  accentColor: string;
}

const CtaButton = ({ accentColor, label, onPress }: CtaButtonProps) => {
  const textLightColor = colord(accentColor).lighten(0.13).toHex();
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: withTiming(pressed.value ? 0.97 : 1, { duration: 100 }) },
    ],
  }));
  return (
    <AnimatedPressable
      style={[styles.ctaPill, animatedStyle]}
      layout={LinearTransition.springify()}
      onPress={onPress}
      onPressIn={() => (pressed.value = 1)}
      onPressOut={() => (pressed.value = 0)}
    >
      <Text style={[styles.ctaText, { color: textLightColor }]}>{label}</Text>
      <EntypoIcons name="chevron-right" size={54} color={textLightColor} />
    </AnimatedPressable>
  );
};

export default CtaButton;

const styles = StyleSheet.create({
  ctaPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    backgroundColor: "#414141",
    alignSelf: "flex-start",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 100,
  },
  ctaText: {
    fontSize: 36,
    fontFamily: "KronaOne",
  },
});
