/* eslint-disable react-hooks/immutability */
import { Pressable, StyleSheet } from "react-native";
import Icon from "@react-native-vector-icons/fontawesome6";
import { colord } from "colord";
import {
  createAnimatedComponent,
  interpolate,
  SharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  useSharedValue,
  Easing,
} from "react-native-reanimated";
import { useEffect } from "react";

interface RecordingButtonsProps {
  color: string;
  type: "play" | "stop";
  onPress: () => void;
  recording: SharedValue<number>;
  paused?: boolean;
}

const AnimatedPressable = createAnimatedComponent(Pressable);
const AnimatedIcon = createAnimatedComponent(Icon);

const ICON_WIDTH = 44;
const AudioButtons = ({
  color,
  type,
  onPress,
  recording,
  paused,
}: RecordingButtonsProps) => {
  const iconColor = colord(color).darken(0.25).desaturate(0.2).toHex();
  const iconBGColor = colord(color).lighten(0.13).toHex();

  const iconScale = useSharedValue(1);
  const iconOpacity = useSharedValue(1);
  const pressed = useSharedValue(0);

  useEffect(() => {
    if (type !== "play") return;
    iconScale.value = withSequence(
      withTiming(0, { duration: 100, easing: Easing.in(Easing.ease) }),
      withSpring(1, { damping: 70 }),
    );
    iconOpacity.value = withSequence(
      withTiming(0, { duration: 100, easing: Easing.in(Easing.ease) }),
      withTiming(1, { duration: 150, easing: Easing.out(Easing.ease) }),
    );
  }, [iconOpacity, iconScale, paused, type]);

  const outputTranslation =
    type === "play" ? [-ICON_WIDTH * 3, 0] : [ICON_WIDTH * 3, 0];

  const containerStyles = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: withSpring(
          interpolate(recording.value, [0, 1], outputTranslation),
          { damping: 70 },
        ),
      },
      {
        scale: withSpring(interpolate(pressed.value, [0, 1], [1, 0.85]), {
          damping: 70,
        }),
      },
    ],
  }));

  const iconStyles = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
    opacity: iconOpacity.value,
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        pressed.value = withTiming(1, { duration: 100 });
      }}
      onPressOut={() => {
        pressed.value = withTiming(0, { duration: 100 });
      }}
      style={[
        styles.actions,
        { backgroundColor: iconBGColor },
        containerStyles,
      ]}
    >
      <AnimatedIcon
        name={type === "play" && paused ? "pause" : type}
        iconStyle="solid"
        size={24}
        color={iconColor}
        style={[
          type === "play" && !paused && { transform: [{ translateX: 2 }] },
          iconStyles, // ← scale animation on the icon itself
        ]}
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
