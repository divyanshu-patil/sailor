import { useCallback, useEffect, useRef, useState } from "react";
import { SharedValue, useAnimatedReaction } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

export const useRecordingTimer = (
  isRecording: SharedValue<boolean>,
  isPaused: SharedValue<boolean>,
  isStopped: SharedValue<boolean>,
) => {
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback(() => {
    intervalRef.current = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
  }, []);

  const pauseTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const fullStopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setSeconds(0);
  }, []);

  useAnimatedReaction(
    () => ({
      recording: isRecording.value,
      paused: isPaused.value,
      stopped: isStopped.value,
    }),
    (current, prev) => {
      if (current.recording && !prev?.recording) scheduleOnRN(startTimer);
      if (!current.recording && prev?.recording && current.paused)
        scheduleOnRN(pauseTimer);
      if (current.stopped && !prev?.stopped) scheduleOnRN(fullStopTimer);
    },
  );

  useEffect(() => () => fullStopTimer(), [fullStopTimer]);

  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;

  // Split into individual characters so only changed digits animate
  const minutesTens = Math.floor(minutes / 10);
  const minutesOnes = minutes % 10;
  const secsTens = Math.floor(secs / 10);
  const secsOnes = secs % 10;

  return { minutesTens, minutesOnes, secsTens, secsOnes };
};
