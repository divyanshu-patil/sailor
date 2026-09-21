import { memo, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Icon from "@react-native-vector-icons/lucide";

import PressableScale from "@/components/ui/animated/PressableScale";
import { fonts } from "@/constants/fonts";

/** Height of the clip window. Both slots are this tall and travel by it. */
const CLIP_HEIGHT = 30;

const formatElapsed = (ms: number) => {
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

interface StartButtonProps {
  /** The prompt has been started at least once — the label has gone. */
  started: boolean;
  /** The prompt is scrolling and the clock is counting. */
  running: boolean;
  onPress: () => void;
}

/**
 * Start, and then the clock.
 *
 * The same trick as the practice screen's record button: the label and the
 * stopwatch are two slots in a clipped window, and starting slides the label
 * up and out while the stopwatch rises into its place. One shared value drives
 * both, so they move as one piece of paper rather than two things fading past
 * each other.
 *
 * The clock is kept here rather than on the screen: it ticks four times a
 * second and nothing above this button cares what it says, so re-rendering it
 * costs one small component instead of the whole prompt.
 */
const StartButton = memo(function StartButton({
  started,
  running,
  onPress,
}: StartButtonProps) {
  const progress = useSharedValue(0);
  const [elapsed, setElapsed] = useState(0);
  /** Milliseconds banked by the runs before this one. */
  const banked = useRef(0);

  useEffect(() => {
    progress.value = withTiming(started ? 1 : 0, {
      duration: 350,
      easing: Easing.inOut(Easing.ease),
    });
  }, [started, progress]);

  useEffect(() => {
    if (!started) {
      banked.current = 0;
      setElapsed(0);
    }
  }, [started]);

  useEffect(() => {
    if (!running) return;
    const startedAt = Date.now();
    const base = banked.current;
    const tick = () => setElapsed(base + Date.now() - startedAt);
    tick();
    const id = setInterval(tick, 200);
    return () => {
      clearInterval(id);
      // Bank what this run added, so a pause holds the number and resuming
      // carries on from it instead of restarting at zero.
      banked.current = base + Date.now() - startedAt;
    };
  }, [running]);

  const labelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(progress.value, [0, 1], [0, -CLIP_HEIGHT]) }],
    opacity: interpolate(progress.value, [0, 0.5, 1], [1, 0, 0]),
  }));

  const clockStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(progress.value, [0, 1], [CLIP_HEIGHT, 0]) }],
    opacity: interpolate(progress.value, [0, 0.5, 1], [0, 0, 1]),
  }));

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={
        !started ? "Start the prompt" : running ? "Pause the prompt" : "Resume the prompt"
      }
      onPress={onPress}
      style={styles.pill}
    >
      <View style={styles.clip}>
        <Animated.View style={[styles.slot, labelStyle]}>
          <Icon name="play" size={19} color="#FFFFFF" />
          <Text style={styles.label}>Start</Text>
        </Animated.View>

        <Animated.View style={[styles.slot, clockStyle]}>
          <Icon name={running ? "timer" : "play"} size={19} color="#FFFFFF" />
          <Text style={styles.clock}>{formatElapsed(elapsed)}</Text>
        </Animated.View>
      </View>
    </PressableScale>
  );
});

export default StartButton;

const styles = StyleSheet.create({
  pill: {
    minWidth: 196,
    paddingHorizontal: 28,
    paddingVertical: 15,
    borderRadius: 999,
    backgroundColor: "#211E1C",
    alignItems: "center",
    justifyContent: "center",
  },
  clip: {
    height: CLIP_HEIGHT,
    alignSelf: "stretch",
    overflow: "hidden",
    justifyContent: "center",
  },
  slot: {
    ...StyleSheet.absoluteFill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  label: {
    fontFamily: fonts.alanSans.bold,
    fontSize: 18,
    color: "#FFFFFF",
  },
  clock: {
    fontFamily: fonts.alanSans.semiBold,
    fontSize: 18,
    color: "#FFFFFF",
    // Tabular-ish: the seconds changing must not shuffle the icon sideways.
    minWidth: 62,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
});
