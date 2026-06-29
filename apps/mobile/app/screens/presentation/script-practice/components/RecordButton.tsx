/* eslint-disable react-hooks/immutability */
import { Pressable, StyleSheet } from "react-native";
import Animated, {
  createAnimatedComponent,
  Easing,
  interpolateColor,
  LinearTransition,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { colord } from "colord";
import { useRecordButtonSquish } from "../hooks/useRecordSquish";
import RecordButtonContent, { CLIP_HEIGHT } from "./RecordButtonContent";
import AudioButtons from "./AudioButtons";

const AnimatedPressable = createAnimatedComponent(Pressable);

interface RecordButtonProps {
  onPress?: () => void;
  accentColor: string;
  dragX: SharedValue<number>;
  isRecording: SharedValue<number>;
  isRecordingBool: SharedValue<boolean>;
}

const RecordButton = ({
  onPress,
  accentColor,
  dragX,
  isRecording,
  isRecordingBool,
}: RecordButtonProps) => {
  const buttonHighlightColor = colord(accentColor).lighten(0.025).toHex();

  const pressed = useSharedValue(false);
  const colorProgress = useSharedValue(0);
  const { scaleX, scaleY } = useRecordButtonSquish(dragX);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          scale: withSpring(pressed.value ? 0.95 : 1, {
            damping: 50,
          }),
        },
        { scaleY: scaleY.value },
        { scaleX: scaleX.value },
      ],
      transformOrigin: ["50%", "100%", 0],
      backgroundColor: interpolateColor(
        colorProgress.value,
        [0, 1],
        [accentColor, buttonHighlightColor],
      ),
    };
  });

  const handlePress = () => {
    if (!isRecordingBool.value) {
      isRecordingBool.value = true;
      isRecording.value = withTiming(1, {
        duration: 350,
        easing: Easing.inOut(Easing.ease),
      });
    }
    onPress?.();
  };

  const handleRecStop = () => {
    isRecordingBool.value = false;
    isRecording.value = withTiming(0, {
      duration: 350,
      easing: Easing.inOut(Easing.ease),
    });
  };
  return (
    <AnimatedPressable
      disabled={isRecordingBool.value}
      style={[styles.ctaPill, animatedStyle]}
      layout={LinearTransition.springify()}
      onPress={handlePress}
      onPressIn={() => {
        pressed.value = true; // instant -> spring starts immediately
        colorProgress.value = withTiming(1, { duration: 300 }); // smooth color
      }}
      onPressOut={() => {
        pressed.value = false;
        colorProgress.value = withTiming(0, { duration: 150 });
      }}
    >
      <AudioButtons
        recording={isRecording}
        color={accentColor}
        type="play"
        onPress={() => {}}
      />

      <Animated.View
        layout={LinearTransition.springify()}
        style={[styles.waveformContainer]}
      >
        <RecordButtonContent isRecording={isRecording} />
      </Animated.View>
      <AudioButtons
        recording={isRecording}
        color={accentColor}
        type="stop"
        onPress={handleRecStop}
      />
    </AnimatedPressable>
  );
};

export default RecordButton;

const styles = StyleSheet.create({
  ctaPill: {
    backgroundColor: "#7B75E0",
    borderRadius: 50,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    flexDirection: "row",
    overflow: "hidden",
  },
  ctaText: {
    color: "white",
    fontSize: 17,
    fontFamily: "KronaOne",
    alignSelf: "center",
  },
  actions: {
    padding: 8,
    borderRadius: 100,
    justifyContent: "center",
    alignItems: "center",
    width: 44,
    aspectRatio: 1,
  },
  waveformContainer: {
    paddingHorizontal: 12,
    flex: 1,
    height: CLIP_HEIGHT + 12,
  },
});
