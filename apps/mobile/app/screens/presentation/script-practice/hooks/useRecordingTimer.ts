import { useEffect, useRef, useState } from "react";
import { SharedValue, useAnimatedReaction } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

// useRecordingTimer.ts — react to the boolean SV instead
export const useRecordingTimer = (isRecording: SharedValue<boolean>) => {
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = () => {
    setSeconds(0);
    intervalRef.current = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setSeconds(0);
  };

  useAnimatedReaction(
    () => isRecording.value,
    (current, prev) => {
      if (current && !prev) scheduleOnRN(startTimer);
      if (!current && prev) scheduleOnRN(stopTimer);
    },
  );

  useEffect(() => () => stopTimer(), []);

  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;

  // Split into individual characters so only changed digits animate
  const minutesTens = Math.floor(minutes / 10);
  const minutesOnes = minutes % 10;
  const secsTens = Math.floor(secs / 10);
  const secsOnes = secs % 10;

  return { minutesTens, minutesOnes, secsTens, secsOnes };
};
