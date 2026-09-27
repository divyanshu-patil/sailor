import React, { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, View, Keyboard } from "react-native";
import {
  useLocalSearchParams,
  Stack,
  router,
  useFocusEffect,
  useNavigation,
} from "expo-router";
import { useScriptGeneration } from "../../hooks/use-script-generation";
import { PresentationFormState } from "../../new-script/types/types";
import GeneratingScreen from "./components/generating";
import BlobBackground from "../components/background";
import StatusText from "./components/generating/components/status-text";
import { getGeneratingMessages } from "./components/generating/utils/get-generation-messages";
import { useHeaderHeight } from "expo-router/build/react-navigation";
import ScriptText from "./components/script-text/script-text";
import ReviseBar, { ReviseBarRef } from "./components/revise-bar";
import { useScriptStore } from "@/store/script-store";
import { useColors } from "@/constants/theme";
import { KeyboardController } from "react-native-keyboard-controller";

type GeneratePreviewParams = {
  /** The brief, when arriving from the wizard. */
  form?: string;
  /** An existing generation to pick back up, when arriving from drafts. Exactly
   *  one of the two is set. */
  generationId?: string;
};

const PreviewScreen = () => {
  const reviseBarRef = useRef<ReviseBarRef>(null);
  // Untyped on purpose: expo-router's generated route types don't reach
  // `navigation.reset`, which is typed against the parent navigator's own route
  // list rather than the file-based one.
  const navigation = useNavigation<any>();

  const headerHeight = useHeaderHeight();
  const { form, generationId: resumeId } =
    useLocalSearchParams<GeneratePreviewParams>();
  const formState: PresentationFormState | null = useMemo(
    () => (form ? JSON.parse(form) : null),
    [form],
  );

  const {
    state,
    result,
    error,
    generationId,
    startGeneration,
    resumeGeneration,
    stopGeneration,
    retryGeneration,
    revise,
    canUndo,
    canRedo,
    undo,
    redo,
  } = useScriptGeneration();

  const [isConfirming, setIsConfirming] = useState(false);

  const title = useScriptStore((s) => s.title);
  const script = useScriptStore((s) => s.script);
  const setResult = useScriptStore((s) => s.setResult);

  const startedRef = useRef(false);

  /**
   * Generate — or resume.
   *
   * Arriving with a `generationId` (from drafts) attaches to that generation
   * directly. Arriving with a brief goes through `startGeneration`, which
   * resolves an unchanged brief to the generation that already exists
   * server-side — so coming here a second time from the wizard picks the running
   * or finished script back up instead of discarding it and paying to produce an
   * identical one. The ref only guards React re-running the effect within a
   * single mount; the real deduplication is the fingerprint on the API.
   */
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    if (resumeId) {
      resumeGeneration(resumeId);
      return;
    }
    if (!formState) return;

    startGeneration({
      attachments: formState.attachments,
      description: formState.description,
      durationMinutes: formState.durationMinutes,
      audienceIndex: formState.audienceIndex,
      cardCount: formState.cardCount,
      mood: formState.mood,
      profession: formState.profession,
      experienceLevel: formState.experienceLevel,
    }).catch(() => {
      // The hook has already put the reason in `error`; the generating screen
      // renders it with a Try again.
    });
  }, [formState, resumeId, resumeGeneration, startGeneration]);

  // sync completed generation into the store — single source of truth from here
  // on, including for the edit modal
  useEffect(() => {
    if (result) {
      setResult({
        generationId: result.id,
        title: result.title,
        script: result.script,
      });
    }
  }, [result, setResult]);

  /**
   * Nothing is cancelled on unmount, deliberately.
   *
   * Backing out of this screen used to terminate the job, so a mistap on the
   * back gesture threw away a script the user had been waiting on — and coming
   * forward again started from zero. Leaving is now free: the generation keeps
   * running, re-entering re-attaches to it, and cancellation is owned by
   * lib/generation-guard, which fires when the user lands on home or
   * backgrounds the app.
   */

  /**
   * Accept the script.
   *
   * The results screen queues card generation itself (`start: "1"`), so its
   * loading state is up the instant Create is tapped rather than after the
   * kickoff round trip. The deck is created only once those cards exist, so
   * results is handed the *generation* id and waits for a deck to come into
   * being. Nothing appears in the user's deck grid in the meantime.
   */
  const handleCreate = () => {
    if (state !== "completed" || !generationId || isConfirming) return;
    // Never reset: this screen is replaced, and a second tap mustn't queue twice.
    setIsConfirming(true);

    // Replace the whole creation stack with the results screen, rather than
    // pushing onto it. Accepting a script is the end of the flow: backing out
    // of the results should go home, not walk back through the script the
    // user just accepted and the wizard that produced it — neither of which
    // can be returned to meaningfully once a deck exists.
    navigation.reset({
      index: 0,
      routes: [{ name: "results", params: { generationId, start: "1" } }],
    });
  };

  // A revision is a job on the same generation, so the revised script arrives
  // through the poller and lands in the store via the effect above.
  const handleRevise = async (instruction: string) => {
    if (!generationId) return false;
    return revise(instruction);
  };

  const { colors } = useColors();

  // Must be memoised. `getGeneratingMessages` builds a fresh array for every
  // state except "generating" (which returns the shared constant), and
  // StatusText resets itself whenever the array identity changes — so an
  // unmemoised call re-rendered StatusText, which produced a new array, which
  // reset it again. That loop starts the instant the state flips to
  // "completed", i.e. exactly when the script arrives.
  const statusLabels = useMemo(
    () => getGeneratingMessages(state, title, error),
    [state, title, error],
  );

  // Dismiss keyboard when screen mounts or comes into focus
  useEffect(() => {
    KeyboardController.dismiss();
    Keyboard.dismiss();
  }, []);

  useFocusEffect(() => {
    KeyboardController.dismiss();
    Keyboard.dismiss();
  });

  const hasScript = state === "completed" && !!script;

  return (
    <>
      {/* Undo/redo across the script's whole history — every generation,
          revision and manual edit is a step. Header-left is the top-bar slot:
          expo-router's toolbar placements are left/right/bottom, and the
          arrows belong beside the back button rather than competing with
          Create on the right. */}
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          icon={"arrow.uturn.backward"}
          hidden={!hasScript}
          tintColor={colors.rust}
          disabled={!canUndo || isConfirming}
          onPress={undo}
        />
        <Stack.Toolbar.Button
          icon={"arrow.uturn.forward"}
          hidden={!hasScript}
          tintColor={colors.rust}
          disabled={!canRedo || isConfirming}
          onPress={redo}
        />
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={"square.and.pencil"}
          hidden={!hasScript}
          tintColor={colors.rust}
          disabled={isConfirming}
          onPress={() => {
            reviseBarRef.current?.blur();
            router.push({
              pathname: "/(authenticated)/(script)/modals/edit-script",
              params: { generationId },
            });
          }}
        />
        <Stack.Toolbar.Button
          hidden={!hasScript}
          tintColor={colors.rust}
          variant="prominent"
          disabled={isConfirming}
          onPress={handleCreate}
        >
          Create
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <View style={{ flex: 1 }}>
        {/* The blobs are 15 concurrent timing animations under a 150px blur,
            all of it re-rendered every frame. That's fine as the focus of a
            waiting screen, but once the script is up it's just competing with
            scrolling for the same frame budget — so it settles. */}
        <BlobBackground animate={!hasScript} />
        <ScrollView
          style={[{ paddingTop: headerHeight + 20 }, styles.container]}
          scrollEnabled={hasScript}
          keyboardDismissMode="on-drag"
        >
          <StatusText labels={statusLabels} accentColor={colors.rust} />

          {hasScript && (
            // No layout transition here: the script mounts in batches, and a
            // layout spring on the container re-measures and re-animates the
            // whole body on every batch — which is most of the stutter when
            // the script lands. The blocks animate themselves instead.
            <View style={styles.scriptContainer}>
              <ScriptText script={script} fontSize={20} />
            </View>
          )}
        </ScrollView>

        {hasScript && (
          <ReviseBar
            ref={reviseBarRef}
            onSubmit={handleRevise}
            accentColor={colors.rust}
          />
        )}

        {state !== "completed" && (
          <GeneratingScreen
            status={state}
            error={error}
            onStop={stopGeneration}
            onRetry={retryGeneration}
          />
        )}
      </View>
    </>
  );
};

export default PreviewScreen;

const styles = StyleSheet.create({
  scriptContainer: { marginTop: 30 },
  container: { flex: 1, paddingHorizontal: 20 },
});
