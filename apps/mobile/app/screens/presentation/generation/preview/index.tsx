import React, { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, View, Keyboard } from "react-native";
import {
  useLocalSearchParams,
  Stack,
  router,
  useFocusEffect,
} from "expo-router";
import {
  useScriptGeneration,
  useDeckGeneration,
} from "../../hooks/use-script-generation";
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
  form: string;
};

const PreviewScreen = () => {
  const reviseBarRef = useRef<ReviseBarRef>(null);

  const headerHeight = useHeaderHeight();
  const { form } = useLocalSearchParams<GeneratePreviewParams>();
  const formState: PresentationFormState = useMemo(
    () => JSON.parse(form),
    [form],
  );

  const { state, result, error, startGeneration, stopGeneration, revise } =
    useScriptGeneration();

  const [isConfirming, setIsConfirming] = useState(false);
  const { startDeckGeneration } = useDeckGeneration();

  const handleCreate = async () => {
    if (state !== "completed" || !jobId) return;

    try {
      setIsConfirming(true);
      const deckJobId = await startDeckGeneration(jobId);
      router.push({
        pathname: "/(authenticated)/(script)/results",
        params: { jobId: deckJobId },
      });
    } catch {
      // deckError will already be set by the hook; surface it however you
      // show errors elsewhere on this screen (toast, inline text, etc.)
    } finally {
      setIsConfirming(false);
    }
  };

  const jobId = useScriptStore((s) => s.jobId);
  const title = useScriptStore((s) => s.title);
  const script = useScriptStore((s) => s.script);
  const setResult = useScriptStore((s) => s.setResult);

  const startedRef = useRef(false);
  const stateRef = useRef(state);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    startGeneration({
      attachments: formState.attachments,
      description: formState.description,
      durationMinutes: formState.durationMinutes,
      audienceIndex: formState.audienceIndex,
      cardCount: formState.cardCount,
    });
  }, [
    formState.attachments,
    formState.audienceIndex,
    formState.cardCount,
    formState.description,
    formState.durationMinutes,
    startGeneration,
  ]);

  // sync completed generation into the store — single source of truth from here on
  useEffect(() => {
    if (state === "completed" && result) {
      setResult({
        job_id: result.job_id,
        title: result.title,
        script: result.script,
      });
    }
  }, [state, result, setResult]);

  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      if (stateRef.current === "generating") {
        stopGeneration();
      }
    };
  }, [stopGeneration]);

  // A revision is a job on the same deck, so the revised script arrives through
  // the poller and lands in the store via the effect above — nothing to set here.
  const handleRevise = async (instruction: string) => {
    if (!jobId) return;
    await revise(instruction);
  };
  const { colors } = useColors();

  // Must be memoised. `getGeneratingMessages` builds a fresh array for every
  // state except "generating" (which returns the shared constant), and
  // StatusText resets itself whenever the array identity changes — so an
  // unmemoised call re-rendered StatusText, which produced a new array, which
  // reset it again. That loop starts the instant the state flips to
  // "completed", i.e. exactly when the script arrives.
  const statusLabels = useMemo(
    () => getGeneratingMessages(state, title),
    [state, title],
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

  return (
    <>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={"square.and.pencil"}
          hidden={state !== "completed" && !result?.script}
          tintColor={colors.rust}
          disabled={isConfirming}
          onPress={() => {
            reviseBarRef.current?.blur();
            router.push({
              pathname: "/(authenticated)/(script)/modals/edit-script",
              params: { jobId },
            });
          }}
        />
        <Stack.Toolbar.Button
          hidden={state !== "completed" && !result?.script}
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
        <BlobBackground animate={state !== "completed" || !script} />
        <ScrollView
          style={[{ paddingTop: headerHeight + 20 }, styles.container]}
          scrollEnabled={state === "completed" && !!script}
          keyboardDismissMode="on-drag"
        >
          <StatusText labels={statusLabels} accentColor={colors.rust} />

          {state === "completed" && !!script && (
            // No layout transition here: the script mounts in batches, and a
            // layout spring on the container re-measures and re-animates the
            // whole body on every batch — which is most of the stutter when
            // the script lands. The blocks animate themselves instead.
            <View style={styles.scriptContainer}>
              <ScriptText script={script} fontSize={20} />
            </View>
          )}
        </ScrollView>

        {state === "completed" && !!script && (
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
