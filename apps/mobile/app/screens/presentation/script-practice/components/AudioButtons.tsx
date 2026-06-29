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
import { useCallback, useEffect } from "react";

interface RecordingButtonsProps {
  color: string;
  type: "play" | "stop";
  onPress: () => void;
  recording: SharedValue<number>;
  paused?: boolean;
  finished?: boolean; // stopped
}

const AnimatedPressable = createAnimatedComponent(Pressable);
const AnimatedIcon = createAnimatedComponent(Icon);

type TIcon = "play" | "pause" | "stop" | "trash";
const ICON_WIDTH = 44;
const AudioButtons = ({
  color,
  type,
  onPress,
  recording,
  paused,
  finished,
}: RecordingButtonsProps) => {
  const iconColor =
    finished && type === "stop"
      ? colord("#ef4444").darken(0.15).toHex()
      : colord(color).darken(0.25).desaturate(0.2).toHex();

  const iconBGColor =
    finished && type === "stop"
      ? colord("#ef4444").lighten(0.3).toHex()
      : colord(color).lighten(0.13).toHex();

  const iconScale = useSharedValue(1);
  const iconOpacity = useSharedValue(1);
  const pressed = useSharedValue(0);

  useEffect(() => {
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

  const getIcon = useCallback((): TIcon => {
    if (type === "play") {
      if (!paused) return "pause";
      else return "play";
    } else {
      if (finished) return "trash";
      else return "stop";
    }
  }, [finished, paused, type]);

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
        name={getIcon()}
        iconStyle="solid"
        size={24}
        color={iconColor}
        style={[
          type === "play" && !paused && { transform: [{ translateX: 2 }] },
          iconStyles,
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
