import { ActivityIndicator, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  interpolate,
  SharedValue,
  FadeInDown,
  Easing,
  LinearTransition,
} from "react-native-reanimated";
import WaveForm from "./WaveForm";
import { fonts } from "@/constants/fonts";

export const CLIP_HEIGHT = 32; // must match waveItem MAX_HEIGHT

interface RecordButtonContentProps {
  isRecording: SharedValue<number>;
  paused?: boolean;
  /** True while the deck's existing recording is being fetched. The label is
   *  replaced by a spinner rather than sitting there inviting a tap that would
   *  start a new take over audio that already exists. */
  loading?: boolean;
}

const RecordButtonContent = ({
  isRecording,
  paused,
  loading,
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
    <Animated.View
      style={styles.clipContainer}
      layout={LinearTransition.springify()}
    >
      <Animated.View
        style={[styles.slot, textStyle]}
        layout={LinearTransition.springify()}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          // Keyed on `loading` so the label mounts fresh the moment the
          // spinner leaves, which is what gives `entering` something to run.
          <Animated.Text
            key="cta"
            entering={FadeInDown.duration(260).easing(Easing.out(Easing.cubic))}
            style={styles.ctaText}
          >
            Tap to Record
          </Animated.Text>
        )}
      </Animated.View>
      <Animated.View style={[styles.slot, waveStyle]}>
        <WaveForm paused={paused} />
      </Animated.View>
    </Animated.View>
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
    fontFamily: fonts.krona,
    textAlign: "center",
  },
});
