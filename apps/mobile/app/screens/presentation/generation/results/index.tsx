import { fonts } from "@/constants/fonts";
import { useColors } from "@/constants/theme";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef } from "react";
import { StyleSheet } from "react-native";
import GeneratingScreen from "../preview/components/generating";
import { useDeckGeneration } from "../../hooks/use-script-generation";
import BlobBackground from "../components/background";

import { useHeaderHeight } from "expo-router/build/react-navigation";
import StatusText from "../preview/components/generating/components/status-text";
import { getGeneratingMessages } from "../preview/components/generating/utils/get-generation-messages";
import Card from "./components/card";
import Spacer from "@/components/ui/shared/spacer";
import Animated, { LinearTransition } from "react-native-reanimated";
import { useDeck } from "@/hooks/use-deck";

type ResultsScreenParams = {
  /** The generation whose script was accepted. Not a deck id — there is no deck
   *  yet. Cards are generated first and the deck is written together with them,
   *  so this screen waits for one to exist rather than rendering an empty one. */
  generationId: string;
  /** "1" when arriving from Create: this screen queues the build itself, so it
   *  shows its loading state without waiting on the kickoff request. */
  start?: string;
};

const ResultsScreen = () => {
  const { colors } = useColors();
  const { generationId, start } = useLocalSearchParams<ResultsScreenParams>();

  const {
    state,
    deckId,
    error,
    createDeck,
    resumeDeckGeneration,
    retryDeckGeneration,
    stopDeckGeneration,
  } = useDeckGeneration();

  // Only queried once the deck exists. `useDeck` is given an empty id until
  // then, which reads nothing and fetches nothing — there is no row to find.
  const { data: deck } = useDeck({ deckId: deckId ?? "", immediate: !!deckId });

  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current || !generationId) return;
    startedRef.current = true;
    if (start === "1") {
      // A failed kickoff is already the poller's "failed" state, with Try again.
      createDeck(generationId).catch(() => {});
    } else {
      resumeDeckGeneration(generationId);
    }
  }, [generationId, start, createDeck, resumeDeckGeneration]);

  /**
   * Card generation isn't cancelled on unmount, for the same reason the script
   * isn't: leaving a screen is not a decision to throw work away. The job
   * finishes and the deck appears in the grid whenever the user next looks.
   * Only the explicit Stop below cancels — and because nothing is written until
   * the job completes, cancelling leaves a draft rather than a broken deck.
   */

  const headerHeight = useHeaderHeight();
  return (
    <>
      {/* The only way out, and it leads home rather than back through the
          wizard: the preview screen replaces the whole creation stack with this
          one when the script is accepted, so there is nothing behind it. */}
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          variant="prominent"
          tintColor={colors.rust}
          hidden={state !== "completed"}
          onPress={() =>
            router.canGoBack()
              ? router.back()
              : router.replace("/(authenticated)/(tabs)/(home)")
          }
        >
          Done
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
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
            labels={getGeneratingMessages(
              state,
              "Your Deck is Ready",
              error,
              "deck",
            )}
            accentColor={colors.rust}
          />
        </Animated.View>
        <Spacer />
        {deck && <Card item={deck} />}
        <Spacer />
      </Animated.View>
      {state !== "completed" && (
        <GeneratingScreen
          status={state}
          error={error}
          onStop={stopDeckGeneration}
          onRetry={retryDeckGeneration}
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
  },
});
