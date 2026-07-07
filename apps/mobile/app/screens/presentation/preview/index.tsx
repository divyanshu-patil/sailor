/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useRef } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useScriptGeneration } from "../hooks/use-script-generation";
import { PresentationFormState } from "../new-script/types/types";
import GeneratingScreen from "../generating";
import BlobBackground from "./components/background";
import StatusText from "../generating/components/status-text";
import { getGeneratingMessages } from "../generating/utils/get-generation-messages";
import { useHeaderHeight } from "expo-router/build/react-navigation";
import ScriptText from "./components/script-text/script-text";
import Animated, { LinearTransition } from "react-native-reanimated";

type GeneratePreviewParams = {
  form: string;
};

// const ANIMATION_DURATION = 300; // depends on the TextMorph component's morph animation

const PreviewScreen = () => {
  const headerHeight = useHeaderHeight();
  const { form } = useLocalSearchParams<GeneratePreviewParams>();

  const formState: PresentationFormState = JSON.parse(form);
  const { state, result, error, startGeneration, stopGeneration } =
    useScriptGeneration();

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
  }, []);

  useEffect(() => {
    return () => {
      if (stateRef.current === "generating") {
        stopGeneration(); // fire-and-forget, not awaited
      }
    };
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <BlobBackground />
      <ScrollView
        style={[{ paddingTop: headerHeight }, styles.container]}
        scrollEnabled={state === "completed" && !!result}
      >
        <StatusText
          labels={getGeneratingMessages(state, result?.title)}
          accentColors={["#B75C5C"]}
        />

        {state === "completed" && !!result && (
          <Animated.View
            layout={LinearTransition.springify()}
            style={styles.scriptContainer}
          >
            <ScriptText script={result?.script} fontSize={20} />
          </Animated.View>
        )}
      </ScrollView>
      {state !== "completed" && (
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
  scriptContainer: { marginTop: 30 },
  container: { flex: 1, paddingHorizontal: 20 },
});
