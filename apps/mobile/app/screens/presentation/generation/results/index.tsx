import { fonts } from "@/constants/fonts";
import { useColors } from "@/constants/theme";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import GeneratingScreen from "./components/generating";
import { useDeckGeneration } from "../../hooks/use-script-generation";
import { deckService } from "@/services/deck.debug.service";
import BlobBackground from "../components/background";

type ResultsScreenParams = {
  jobId: string; // deck job id, handed off from PreviewScreen's handleCreate
};

const ResultsScreen = () => {
  const { colors } = useColors();
  const { jobId } = useLocalSearchParams<ResultsScreenParams>();

  const { state, result, error, resumeDeckGeneration, stopDeckGeneration } =
    useDeckGeneration();

  const [isOpening, setIsOpening] = useState(false);

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

  const handleOpenCard = async () => {
    if (!result?.id || isOpening) return;

    console.log(result);
    try {
      setIsOpening(true);
      // Detail screen renders from route params first (for the AppleZoom
      // transition), same as when opened from AllScriptsScreen's Card —
      // so fetch the full deck now rather than passing a bare id.
      const deck = await deckService.getDeck(result.id);

      router.push({
        pathname: "/(authenticated)/(script)/[id]",
        params: {
          id: deck.id,
          title: deck.title,
          description: deck.description,
          color: deck.color,
          updatedAt: deck.updatedAt.toISOString(),
          slideCount: String(deck.slideCount),
          durationMins: String(deck.durationMins),
          isFavourite: JSON.stringify(deck.isFavourite),
        },
      });
    } catch {
      // best-effort — surface however you show errors elsewhere on this screen
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <>
      <BlobBackground />
      {state !== "idle" ? (
        <GeneratingScreen
          status={state}
          error={error}
          onStop={stopDeckGeneration}
        />
      ) : (
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.container}
        >
          <Text style={[styles.title, { color: colors.rust }]}>
            Your deck is ready
          </Text>

          <Pressable
            style={[styles.button, { backgroundColor: colors.rust }]}
            onPress={handleOpenCard}
            disabled={isOpening}
          >
            <Text style={styles.buttonText}>
              {isOpening ? "Opening…" : "Open"}
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </>
  );
};

export default ResultsScreen;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 30,
    alignItems: "center",
    gap: 24,
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
});
