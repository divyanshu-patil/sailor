import { Pressable, StyleSheet } from "react-native";
import Icon from "@react-native-vector-icons/fontawesome6";
import { colord } from "colord";
import {
  createAnimatedComponent,
  interpolate,
  SharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";

interface RecordingButtonsProps {
  color: string;
  type: "play" | "stop";
  onPress: () => void;
  recording: SharedValue<number>;
}

const AnimatedPressable = createAnimatedComponent(Pressable);

const ICON_WIDTH = 44;
const AudioButtons = ({
  color,
  type,
  onPress,
  recording,
}: RecordingButtonsProps) => {
  const iconColor = colord(color).darken(0.25).desaturate(0.2).toHex();
  const iconBGColor = colord(color).lighten(0.13).toHex();

  const outputTranslation =
    type === "play"
      ? [-ICON_WIDTH * 3, 0] // slides in from left: hidden → visible
      : [ICON_WIDTH * 3, 0];

  const animatedStyles = useAnimatedStyle(() => {
    console.log(recording.value);
    return {
      transform: [
        {
          translateX: withSpring(
            interpolate(recording.value, [0, 1], outputTranslation),
            {
              damping: 70,
            },
          ),
        },
      ],
    };
  });

  return (
    <AnimatedPressable
      onPress={onPress}
      style={[styles.actions, { backgroundColor: iconBGColor }, animatedStyles]}
    >
      <Icon
        name={type}
        iconStyle="solid"
        size={24}
        color={iconColor}
        style={type === "play" && { transform: [{ translateX: 2 }] }} // play button visual shift
      />
    </AnimatedPressable>
  );
};

export default AudioButtons;

const styles = StyleSheet.create({
  actions: {
    padding: 8,
    borderRadius: 100,
    justifyContent: "center",
    alignItems: "center",
    width: ICON_WIDTH,
    aspectRatio: 1,
  },
});
