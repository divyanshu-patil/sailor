import React, { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  useLocalSearchParams,
  Stack,
  router,
  useFocusEffect,
} from "expo-router";
import {
  useScriptGeneration,
  useDeckGeneration,
} from "../hooks/use-script-generation";
import { PresentationFormState } from "../new-script/types/types";
import GeneratingScreen from "./components/generating";
import BlobBackground from "./components/background";
import StatusText from "./components/generating/components/status-text";
import { getGeneratingMessages } from "./components/generating/utils/get-generation-messages";
import { useHeaderHeight } from "expo-router/build/react-navigation";
import ScriptText from "./components/script-text/script-text";
import Animated, { LinearTransition } from "react-native-reanimated";
import ReviseBar from "./components/revise-bar";
import { useScriptStore } from "@/store/script-store";
import { scriptService } from "@/services/script.debug.service";
import { useColors } from "@/constants/theme";
import { KeyboardController } from "react-native-keyboard-controller";

type GeneratePreviewParams = {
  form: string;
};

const PreviewScreen = () => {
  const headerHeight = useHeaderHeight();
  const { form } = useLocalSearchParams<GeneratePreviewParams>();
  const formState: PresentationFormState = useMemo(
    () => JSON.parse(form),
    [form],
  );

  const { state, result, error, startGeneration, stopGeneration } =
    useScriptGeneration();

  const [isConfirming, setIsConfirming] = useState(false);
  const { startDeckGeneration } = useDeckGeneration();

  const handleCreate = async () => {
    if (state !== "completed" || !jobId) return;

    try {
      setIsConfirming(true);
      const deckJobId = await startDeckGeneration(jobId);
      // startDeckGeneration resolves as soon as the job is kicked off (not
      // once it's done). If you want to block navigation until the deck is
      // actually ready, poll `deckState` here instead of navigating right away —
      // e.g. show a spinner on the button and navigate in a useEffect that
      // watches deckState === "completed".
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

  const handleRevise = async (instruction: string) => {
    if (!jobId) return;
    const revised = await scriptService.revise(jobId, instruction);
    setResult(revised);
  };
  const { colors } = useColors();

  useFocusEffect(() => {
    KeyboardController.dismiss();
  });

  return (
    <>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={"square.and.pencil"}
          hidden={state !== "completed" && !result?.script}
          tintColor={colors.rust}
          onPress={() => {
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
        <BlobBackground />
        <ScrollView
          style={[{ paddingTop: headerHeight + 20 }, styles.container]}
          scrollEnabled={state === "completed" && !!script}
          keyboardDismissMode="on-drag"
        >
          <StatusText
            labels={getGeneratingMessages(state, title)}
            accentColor={colors.rust}
          />

          {state === "completed" && !!script && (
            <Animated.View
              layout={LinearTransition.springify()}
              style={styles.scriptContainer}
            >
              <ScriptText script={script} fontSize={20} />
            </Animated.View>
          )}
        </ScrollView>

        {state === "completed" && !!script && (
          <ReviseBar onSubmit={handleRevise} accentColor={colors.rust} />
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
