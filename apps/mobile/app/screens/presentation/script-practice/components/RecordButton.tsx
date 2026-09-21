import { Alert, Linking, Platform, StyleSheet, View } from "react-native";
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
import React, { useEffect, useRef, useState } from "react";
import {
  AudioModule,
  RecordingPresets,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
} from "expo-audio";
import { scheduleOnRN } from "react-native-worklets";
import { AnimatedPressable } from "@/components/ui/animated/AnimatedComponents";
import { audioService } from "@/services/audio.service";
import {
  cacheAudio,
  cacheLocalAudio,
  deleteCachedAudio,
  getCachedAudioUri,
} from "@/utils/audio-cache";
import { fonts } from "@/constants/fonts";
import { haptics } from "@/lib/haptics";

interface RecordButtonProps {
  onPress?: () => void;
  accentColor: string;
  /** Whose recording this is. One per deck, server-side and on disk. */
  deckId: string;
  /**
   * Whether takes belong on the server. False when practising someone else's
   * public deck: the audio endpoints are owner-only, so every call would 404 —
   * and if they didn't, a listener's take would overwrite the author's. Public
   * practice records and plays back locally and syncs nothing.
   */
  syncRecording?: boolean;
  dragX: SharedValue<number>;
  isRecording: SharedValue<number>;
  isRecordingBool: SharedValue<boolean>;
  isPaused: SharedValue<boolean>;
  isStopped: SharedValue<boolean>;
  onRecordingFinished?: (uri: string, seconds: number) => void;
  onPlaybackProgress?: (progress: number) => void;
  onTrash?: () => void;
}

const RecordButton = React.memo(
  ({
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
    deckId,
    syncRecording = true,
  }: RecordButtonProps) => {
    const [paused, setPaused] = useState<boolean>(false);
    const [finished, setFinished] = useState<boolean>(false);

    // Fetching the deck's existing recording. True on first open only, and
    // only for as long as there is something to fetch.
    const [loadingExisting, setLoadingExisting] = useState<boolean>(true);
    // The take on screen is already on the server, so the confirm tick has
    // nothing left to do and is hidden.
    const [saved, setSaved] = useState<boolean>(false);
    const [uploading, setUploading] = useState<boolean>(false);

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

    /**
     * Load this deck's existing recording, once, on open.
     *
     * Deliberately here and not on the deck list or in a prefetch: a recording
     * is several megabytes and most decks are opened without anyone wanting to
     * hear one, so it is fetched at the only moment it can actually be played.
     *
     * Disk first. A cached take needs no network at all, which is the whole
     * point of caching it — and the presigned URL it came from has expired long
     * before the file has.
     */
    useEffect(() => {
      let cancelled = false;

      const restore = (uri: string) => {
        if (cancelled) return;
        recordingUriRef.current = uri;
        setRecordingUri(uri);
        awaitingDurationRef.current = true;
        audioPlayer.replace(uri);
        // Same resting state as a take the user just stopped: playable, with
        // delete available. `saved` hides the confirm tick — this one is
        // already on the server, which is where it came from.
        setFinished(true);
        setPaused(true);
        setSaved(true);
        isRecording.value = withTiming(1, {
          duration: 350,
          easing: Easing.inOut(Easing.ease),
        });
      };

      (async () => {
        try {
          // Nothing of the user's was ever stored for a public deck, and the
          // author's recording is not theirs to hear.
          if (!syncRecording) return;

          const cached = getCachedAudioUri(deckId);
          if (cached) {
            restore(cached);
            return;
          }

          const { audio_url } = await audioService.getPlaybackUrl(deckId);
          const localUri = await cacheAudio(deckId, audio_url);
          restore(localUri);
        } catch (e: any) {
          // 404 is the normal answer for a deck nobody has recorded yet, not a
          // failure worth surfacing.
          if (e?.response?.status !== 404) {
            console.log(
              "load deck audio failed",
              e?.response?.status,
              e?.message,
            );
          }
        } finally {
          if (!cancelled) setLoadingExisting(false);
        }
      })();

      return () => {
        cancelled = true;
      };
      // Runs once per deck. `audioPlayer` and `isRecording` are stable refs.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [deckId, syncRecording]);

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

    /** Start a take, having already cleared permissions and any prior audio. */
    const beginRecording = async () => {
      haptics.recordStart();
      isRecordingBool.value = true;
      isRecording.value = withTiming(1, {
        duration: 350,
        easing: Easing.inOut(Easing.ease),
      });
      await startNativeRecording();
      onPress?.();
    };

    const handlePress = async () => {
      if (loadingExisting) return;

      if (!isRecordingBool.value && !isPaused.value) {
        const { granted } =
          await AudioModule.requestRecordingPermissionsAsync();
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

        // Recording over a deck that already has audio destroys it — the
        // server keys one object per deck, so the upload overwrites rather
        // than adding. Say so before the take starts, not after.
        if (saved) {
          Alert.alert(
            "Replace Recording?",
            "This deck already has a recording. Starting a new one will delete it.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Replace",
                style: "destructive",
                onPress: () => {
                  // The old take is about to be thrown away. `beginRecording`
                  // plays its own start cue a moment later, so the two read as
                  // "gone, now going again" rather than one ambiguous buzz.
                  haptics.destroy();
                  void discardExisting().then(beginRecording);
                },
              },
            ],
          );
          return;
        }

        await beginRecording();
        return;
      }
      onPress?.();
    };

    /** Remove the stored take, locally and on the server, before a new one
     *  replaces it. Failing server-side is survivable: the next upload
     *  overwrites the same key anyway. */
    const discardExisting = async () => {
      audioPlayer.pause();
      deleteCachedAudio(deckId);
      setSaved(false);
      setFinished(false);
      setPaused(false);
      setRecordingUri(null);
      recordingUriRef.current = null;
      awaitingDurationRef.current = false;
      onTrash?.();
      if (!syncRecording) return;
      try {
        await audioService.deleteRecording(deckId);
      } catch (e: any) {
        console.log("delete existing recording failed", e?.response?.status);
      }
    };

    const handlePause = async () => {
      haptics.recordPause();
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
      haptics.recordStop();
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

    /**
     * The confirm tick: upload the take that's on screen and keep it.
     *
     * Nothing is sent until this is pressed. A recording the user is still
     * deciding about shouldn't cost them an upload, and the tick is the moment
     * they say to keep it. The local file is then adopted into the cache
     * directly rather than downloaded back — same bytes, no round trip.
     */
    const handleConfirm = async () => {
      const uri = recordingUriRef.current;
      if (!uri || uploading || saved) return;

      setUploading(true);
      try {
        if (syncRecording) await audioService.uploadRecording(deckId, uri);
        try {
          cacheLocalAudio(deckId, uri);
        } catch (e) {
          // The recording is safe on the server; a failed local copy only
          // costs a download the next time this deck is opened.
          console.log("cache recording failed", e);
        }
        setSaved(true);
        // The take is kept. Bigger than a tap, smaller than the streak — this
        // is the moment the recording stops being provisional.
        haptics.successBig();
      } catch (e: any) {
        haptics.error();
        Alert.alert(
          "Upload Failed",
          e?.response?.data?.detail ??
            "Your recording is still here — tap the check to try again.",
        );
      } finally {
        setUploading(false);
      }
    };

    const handleTrash = () => {
      audioPlayer.pause();
      Alert.alert(
        "Delete Recording",
        "Are you sure you want to delete this recording?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              // Fires on the confirm, not on opening the dialog: the tap that
              // raised the alert has not destroyed anything yet.
              haptics.destroy();
              // single re-render
              setRecordingUri(null);
              setFinished(false);
              setPaused(false);

              recordingUriRef.current = null;
              awaitingDurationRef.current = false;

              // Only a take that was confirmed exists anywhere but here, so
              // only that one needs removing from the cache and the server.
              if (saved) {
                setSaved(false);
                deleteCachedAudio(deckId);
                if (syncRecording) {
                  audioService.deleteRecording(deckId).catch((e) => {
                    console.log("delete recording failed", e?.response?.status);
                  });
                }
              }

              await AudioModule.setAudioModeAsync({
                allowsRecording: true,
                playsInSilentMode: true,
              });

              isRecording.value = withTiming(
                0,
                { duration: 350, easing: Easing.inOut(Easing.ease) },
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
        {/* Held back until the lookup finishes. The slide-out spring starts
            from an untranslated position, so mounting these while the spinner
            is up flashed a play and a delete button into view for a frame
            before they animated off the pill — and there is nothing to play or
            delete until we know whether this deck has a recording. */}
        {!loadingExisting && (
          <AudioButtons
            paused={finished ? !playerStatus.playing : paused}
            finished={finished}
            recording={isRecording}
            color={accentColor}
            type="play"
            onPress={finished ? handlePlaybackToggle : handlePause}
          />
        )}

        <Animated.View
          layout={LinearTransition.springify()}
          style={[styles.waveformContainer]}
        >
          <RecordButtonContent
            isRecording={isRecording}
            paused={finished ? !playerStatus.playing : paused}
            loading={loadingExisting}
          />
        </Animated.View>

        {/* Appears only once a take is stopped and still unsaved. It sits to
            the left of delete so the destructive control keeps the edge
            position it has always had. */}
        <View style={styles.audioButtonsContainer}>
          {finished && !saved && (
            <AudioButtons
              recording={isRecording}
              finished={finished}
              color={accentColor}
              type="confirm"
              loading={uploading}
              onPress={handleConfirm}
            />
          )}

          {!loadingExisting && (
            <AudioButtons
              recording={isRecording}
              finished={finished}
              color={accentColor}
              type="stop"
              onPress={finished ? handleTrash : handleRecStop}
            />
          )}
        </View>
      </AnimatedPressable>
    );
  },
);

RecordButton.displayName = "RecordButton";

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
    fontFamily: fonts.krona,
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
  audioButtonsContainer: {
    flexDirection: "row",
    gap: 10,
  },
});
