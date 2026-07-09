import { fonts } from "@/constants/fonts";
import { useColors } from "@/constants/theme";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, View, StyleSheet, Text } from "react-native";
import GeneratingScreen from "../preview/components/generating";
import { useDeckGeneration } from "../../hooks/use-script-generation";
import { deckService } from "@/services/deck.debug.service";
import BlobBackground from "../components/background";

import { useHeaderHeight } from "expo-router/build/react-navigation";
import StatusText from "../preview/components/generating/components/status-text";
import { getGeneratingMessages } from "../preview/components/generating/utils/get-generation-messages";
import Card from "./components/card";
import Spacer from "@/components/ui/shared/spacer";
import Animated, { LinearTransition } from "react-native-reanimated";

type ResultsScreenParams = {
  jobId: string; // deck job id, handed off from PreviewScreen's handleCreate
};

const ResultsScreen = () => {
  const { colors } = useColors();
  const { jobId } = useLocalSearchParams<ResultsScreenParams>();

  const { state, result, error, resumeDeckGeneration, stopDeckGeneration } =
    useDeckGeneration();

  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current || !jobId) return;
    startedRef.current = true;
    resumeDeckGeneration(jobId);
  }, [jobId, resumeDeckGeneration]);

  useEffect(() => {
    return () => {
      if (state === "generating") {
        stopDeckGeneration();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const headerHeight = useHeaderHeight();
  return (
    <>
      <BlobBackground />

      <Animated.View
        style={[{ paddingTop: headerHeight }, styles.container]}
        layout={LinearTransition.springify().damping(20)}
      >
        <Animated.View
          style={[styles.statusText, { top: headerHeight + 20 }]}
          layout={LinearTransition.springify()}
        >
          <StatusText
            labels={getGeneratingMessages(state, "Your Script is Ready")}
            accentColor={colors.rust}
          />
        </Animated.View>
        <Spacer />
        {result && (
          <Card
            item={{
              ...result,
              updatedAt: new Date(result.updatedAt),
            }}
          />
        )}
        <Spacer />
      </Animated.View>
      {state !== "completed" && (
        <GeneratingScreen
          status={state}
          error={error}
          onStop={stopDeckGeneration}
        />
      )}
    </>
  );
};

export default ResultsScreen;

const styles = StyleSheet.create({
  container: {
    height: "100%",
    paddingHorizontal: 30,
    alignItems: "center",
    position: "relative",
  },
  title: {
    fontFamily: fonts.krona,
    fontSize: 28,
    textAlign: "center",
  },
  button: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 100,
  },
  buttonText: {
    fontFamily: fonts.krona,
    fontSize: 18,
    color: "#fff",
  },
  statusText: {
    position: "absolute",
    // left: 0,
  },
});
