import React, { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useScriptGeneration } from "../hooks/use-script-generation";
import { PresentationFormState } from "../new-script/types/types";
import GeneratingScreen from "../generating";
import ScriptResultScreen from "../results";
import BlobBackground from "./components/background";

type GeneratePreviewParams = {
  form: string;
};

const PreviewScreen = () => {
  const { form } = useLocalSearchParams<GeneratePreviewParams>();

  const formState: PresentationFormState = JSON.parse(form);
  const { state, result, error, startGeneration, stopGeneration } =
    useScriptGeneration();

  const startedRef = useRef(false);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fire cancel on unmount if a job was in flight — no blocking, no bounce.
  // Covers gesture back, header back, and hardware back all at once,
  // since all of them ultimately unmount this screen.
  useEffect(() => {
    return () => {
      if (stateRef.current === "generating") {
        stopGeneration(); // fire-and-forget, not awaited
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      <BlobBackground />
      {state === "completed" && result ? (
        <ScriptResultScreen title={result.title} script={result.script} />
      ) : (
        <GeneratingScreen
          status={state}
          error={error}
          onStop={stopGeneration}
        />
      )}
    </View>
  );
};

export default PreviewScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF4E8" },
});
