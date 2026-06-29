/* eslint-disable react-hooks/immutability */
import { Alert, Linking, Platform, StyleSheet } from "react-native";
import Animated, {
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
import { useEffect, useRef, useState } from "react";
import {
  AudioModule,
  RecordingPresets,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
} from "expo-audio";
import { scheduleOnRN } from "react-native-worklets";
import { AnimatedPressable } from "@/components/ui/animated/AnimatedComponents";

interface RecordButtonProps {
  onPress?: () => void;
  accentColor: string;
  dragX: SharedValue<number>;
  isRecording: SharedValue<number>;
  isRecordingBool: SharedValue<boolean>;
  isPaused: SharedValue<boolean>;
  isStopped: SharedValue<boolean>;
  onRecordingFinished?: (uri: string, seconds: number) => void;
  onPlaybackProgress?: (progress: number) => void;
  onTrash?: () => void;
}

const RecordButton = ({
  onPress,
  accentColor,
  dragX,
  isRecording,
  isRecordingBool,
  isPaused,
  isStopped,
  onRecordingFinished,
  onTrash,
  onPlaybackProgress,
}: RecordButtonProps) => {
  const [paused, setPaused] = useState<boolean>(false);
  const [finished, setFinished] = useState<boolean>(false);

  const buttonHighlightColor = colord(accentColor).lighten(0.025).toHex();
  const pressed = useSharedValue(false);
  const colorProgress = useSharedValue(0);

  const { scaleX, scaleY } = useRecordButtonSquish(dragX);

  const [recordingUri, setRecordingUri] = useState<string | null>(null);

  const audioPlayer = useAudioPlayer(null);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const playerStatus = useAudioPlayerStatus(audioPlayer);

  // Track whether we are waiting for duration to be available after loading a recording
  const awaitingDurationRef = useRef(false);
  const onRecordingFinishedRef = useRef(onRecordingFinished);
  const recordingUriRef = useRef<string | null>(null);
  useEffect(() => {
    onRecordingFinishedRef.current = onRecordingFinished;
  }, [onRecordingFinished]);

  useEffect(() => {
    onPlaybackProgress?.(playerStatus.currentTime);
  }, [onPlaybackProgress, playerStatus.currentTime]);

  // FIX: Once the player has loaded the stopped recording and duration is known,
  // fire onRecordingFinished with the accurate duration from the player itself.
  useEffect(() => {
    if (
      awaitingDurationRef.current &&
      playerStatus.duration > 0 &&
      recordingUriRef.current
    ) {
      awaitingDurationRef.current = false;
      const durationSeconds = Math.floor(playerStatus.duration);
      onRecordingFinishedRef.current?.(
        recordingUriRef.current,
        durationSeconds,
      );
    }
  }, [playerStatus.duration]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          scale: withSpring(pressed.value ? 0.95 : 1, { damping: 50 }),
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

  const startNativeRecording = async () => {
    await AudioModule.setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
    });
    await audioRecorder.prepareToRecordAsync();
    audioRecorder.record();
  };

  const pauseNativeRecording = async () => {
    audioRecorder.pause();
  };

  const resumeNativeRecording = async () => {
    audioRecorder.record();
  };

  const stopNativeRecording = async () => {
    await audioRecorder.stop();
    const uri = audioRecorder.uri;
    setRecordingUri(uri);
    recordingUriRef.current = uri ?? null;

    if (uri) {
      // Flag that we're waiting for the player to report a valid duration.
      // The useEffect above will fire onRecordingFinished once duration > 0.
      awaitingDurationRef.current = true;
      audioPlayer.replace(uri);
    }

    await AudioModule.setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
    });
  };

  const handlePress = async () => {
    if (!isRecordingBool.value && !isPaused.value) {
      const { granted } = await AudioModule.requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert(
          "Permission Denied",
          "Allow permissions in settings to record audio",
          [
            {
              text: "Cancel",
              style: "cancel",
            },
            {
              isPreferred: true,
              text: "Settings",
              style: "default",
              onPress: () => {
                if (Platform.OS === "ios") {
                  Linking.openURL("app-settings:");
                } else {
                  Linking.openSettings();
                }
              },
            },
          ],
        );
        return;
      }
      isRecordingBool.value = true;
      isRecording.value = withTiming(1, {
        duration: 350,
        easing: Easing.inOut(Easing.ease),
      });
      await startNativeRecording();
    }
    onPress?.();
  };

  const handlePause = async () => {
    setPaused((prev) => {
      const next = !prev;
      if (next) {
        isPaused.value = true;
        isRecordingBool.value = false;
      } else {
        isPaused.value = false;
        isRecordingBool.value = true;
      }
      return next;
    });

    if (!paused) {
      // currently playing → going to pause
      await pauseNativeRecording();
    } else {
      // currently paused → resuming
      await resumeNativeRecording();
    }
  };

  const handleRecStop = async () => {
    isPaused.value = false;
    isRecordingBool.value = false;
    isStopped.value = true;
    isRecording.value = withTiming(1, {
      duration: 350,
      easing: Easing.inOut(Easing.ease),
    });
    setPaused(true);
    setFinished(true);
    await stopNativeRecording();

    requestAnimationFrame(() => {
      isStopped.value = false;
    });
  };

  const handleTrash = () => {
    Alert.alert(
      "Delete Recording",
      "Are you sure you want to delete this recording?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            audioPlayer.pause();
            await AudioModule.setAudioModeAsync({
              allowsRecording: true,
              playsInSilentMode: true,
            });
            setRecordingUri(null);
            recordingUriRef.current = null;
            awaitingDurationRef.current = false;
            setFinished(false);
            setPaused(false);
            isRecording.value = withTiming(
              0,
              {
                duration: 350,
                easing: Easing.inOut(Easing.ease),
              },
              () => onTrash && scheduleOnRN(onTrash),
            );
          },
        },
      ],
    );
  };

  const handlePlaybackToggle = () => {
    if (!recordingUri) return;

    if (playerStatus.playing) {
      audioPlayer.pause();
    } else {
      // FIX: Always seek to 0 when the audio has finished playing (currentTime at
      // or past duration). Use a small setTimeout so the seek completes before
      // play() is called — otherwise the player's ended state causes the first
      // play() call to be swallowed and a second tap is needed.
      const isAtEnd =
        playerStatus.duration > 0 &&
        playerStatus.currentTime >= playerStatus.duration;

      if (isAtEnd) {
        audioPlayer.seekTo(0);
        setTimeout(() => {
          audioPlayer.play();
        }, 50);
      } else {
        audioPlayer.play();
      }
    }
  };

  return (
    <AnimatedPressable
      style={[styles.ctaPill, animatedStyle]}
      layout={LinearTransition.springify()}
      onPress={handlePress}
      onPressIn={() => {
        pressed.value = true;
        colorProgress.value = withTiming(1, { duration: 300 });
      }}
      onPressOut={() => {
        pressed.value = false;
        colorProgress.value = withTiming(0, { duration: 150 });
      }}
    >
      <AudioButtons
        paused={finished ? !playerStatus.playing : paused}
        finished={finished}
        recording={isRecording}
        color={accentColor}
        type="play"
        onPress={finished ? handlePlaybackToggle : handlePause}
      />

      <Animated.View
        layout={LinearTransition.springify()}
        style={[styles.waveformContainer]}
      >
        <RecordButtonContent
          isRecording={isRecording}
          paused={finished ? !playerStatus.playing : paused}
        />
      </Animated.View>

      <AudioButtons
        recording={isRecording}
        finished={finished}
        color={accentColor}
        type="stop"
        onPress={finished ? handleTrash : handleRecStop}
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
