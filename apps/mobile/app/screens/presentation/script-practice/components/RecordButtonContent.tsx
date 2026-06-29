import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  interpolate,
  SharedValue,
} from "react-native-reanimated";
import WaveForm from "./WaveForm";

export const CLIP_HEIGHT = 32; // must match waveItem MAX_HEIGHT

interface RecordButtonContentProps {
  isRecording: SharedValue<number>;
  paused?: boolean;
}

const RecordButtonContent = ({
  isRecording,
  paused,
}: RecordButtonContentProps) => {
  // Text slides UP and out when recording starts
  const textStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(isRecording.value, [0, 1], [0, -CLIP_HEIGHT]),
      },
    ],
    opacity: interpolate(isRecording.value, [0, 0.5, 1], [1, 0, 0]),
  }));

  // Waveform slides UP into view when recording starts
  const waveStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(isRecording.value, [0, 1], [CLIP_HEIGHT, 0]),
      },
    ],
    opacity: interpolate(isRecording.value, [0, 0.5, 1], [0, 0, 1]),
  }));

  return (
    <View style={styles.clipContainer}>
      <Animated.View style={[styles.slot, textStyle]}>
        <Text style={styles.ctaText}>Tap to Record</Text>
      </Animated.View>
      <Animated.View style={[styles.slot, waveStyle]}>
        <WaveForm paused={paused} />
      </Animated.View>
    </View>
  );
};

export default RecordButtonContent;

const styles = StyleSheet.create({
  clipContainer: {
    flex: 1,
    height: CLIP_HEIGHT,
    overflow: "hidden", // clips both children
    justifyContent: "center",
  },
  slot: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
  },
  ctaText: {
    color: "white",
    fontSize: 17,
    fontFamily: "KronaOne",
    textAlign: "center",
  },
});
