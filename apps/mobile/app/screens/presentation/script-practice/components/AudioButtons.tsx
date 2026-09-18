/* eslint-disable react-hooks/immutability */
import { ActivityIndicator, StyleSheet } from "react-native";
import Icon from "@react-native-vector-icons/fontawesome6";
import { colord } from "colord";
import { createAnimatedComponent, interpolate, SharedValue, useAnimatedStyle, withSpring, withSequence, withTiming, useSharedValue, Easing, FadeOutRight } from "react-native-reanimated";
import { useCallback, useEffect } from "react";
import { AnimatedPressable } from "@/components/ui/animated/AnimatedComponents";

interface RecordingButtonsProps {
  color: string;
  /** `confirm` is the check that appears beside delete once a take is stopped;
   *  it uploads, and shows a spinner in place of its icon while it does. */
  type: "play" | "stop" | "confirm";
  onPress: () => void;
  recording: SharedValue<number>;
  paused?: boolean;
  finished?: boolean; // stopped
  /** Swaps the icon for an activity indicator tinted to match it. */
  loading?: boolean;
  disabled?: boolean;
}

const AnimatedIcon = createAnimatedComponent(Icon);

type TIcon = "play" | "pause" | "stop" | "trash" | "check";
const ICON_WIDTH = 44;

const DESTRUCTIVE = "#ef4444";
const CONFIRM = "#22c55e";

const AudioButtons = ({
  color,
  type,
  onPress,
  recording,
  paused,
  finished,
  loading,
  disabled,
}: RecordingButtonsProps) => {
  // Each role gets its own hue off the same treatment as the deck accent, so
  // confirm and delete read as opposites without leaving the deck's palette.
  const roleColor =
    type === "confirm"
      ? CONFIRM
      : finished && type === "stop"
        ? DESTRUCTIVE
        : null;

  const iconColor = roleColor
    ? colord(roleColor).darken(0.15).toHex()
    : colord(color).darken(0.25).desaturate(0.2).toHex();

  const iconBGColor = roleColor
    ? colord(roleColor).lighten(0.3).toHex()
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

  // Confirm slides in from the same side as stop — it sits beside delete, and
  // the two share the right-hand edge of the pill.
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
    if (type === "confirm") return "check";
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
      disabled={disabled || loading}
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
      // layout={LinearTransition.springify()}
      exiting={FadeOutRight.springify()}
    >
      {loading ? (
        // Same slot, same size, same colour as the icon it replaces — the
        // button doesn't resize or change tone when it starts working.
        <ActivityIndicator size="small" color={iconColor} />
      ) : (
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
      )}
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
