import { fonts } from "@/constants/fonts";
import { useColors } from "@/constants/theme";
import { useLocalSearchParams } from "expo-router";
import { useHeaderHeight } from "expo-router/build/react-navigation";
import { StyleSheet } from "react-native";
import GeneratingScreen from "../preview/components/generating";
import { useDeckGeneration } from "@/hooks/use-deck-generation";
import BlobBackground from "../components/background";
import StatusText from "../preview/components/generating/components/status-text";
import { getGeneratingMessages } from "../preview/components/generating/utils/get-generation-messages";
import Card from "./components/card";
import Spacer from "@/components/ui/shared/spacer";
import Animated, { LinearTransition } from "react-native-reanimated";
import { DeckItem } from "@/services/deck.debug.service";
import { DeckResponse } from "@/services/deck-generation.service";

type ResultsScreenParams = {
  deckId: string;
};

function toDeckItem(deck: DeckResponse): DeckItem {
  return {
    id: String(deck.id),
    title: deck.title,
    // DeckResponse has no description field — falls back to empty until
    // the backend schema adds one (DeckInfoResponse has it, DeckResponse doesn't).
    description: "",
    color: deck.color,
    slideCount: deck.card_count,
    durationMins: deck.duration_mins,
    isFavourite: deck.is_favorite,
    updatedAt: new Date(deck.updated_at),
  };
}

const ResultsScreen = () => {
  const { colors } = useColors();
  const { deckId } = useLocalSearchParams<ResultsScreenParams>();

  // Reconnects to the ws for this deck on mount — cards were already kicked
  // off by confirm() on the preview screen, so this just resumes watching.
  const { deck, status, isComplete, error, cancel } = useDeckGeneration({
    deckId,
  });

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
            labels={getGeneratingMessages(status, "Your Script is Ready")}
            accentColor={colors.rust}
          />
        </Animated.View>
        <Spacer />
        {isComplete && deck && <Card item={toDeckItem(deck)} />}
        <Spacer />
      </Animated.View>
      {!isComplete && (
        <GeneratingScreen
          status={status ?? "pending"}
          error={error}
          onStop={cancel}
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
  title: { fontFamily: fonts.krona, fontSize: 28, textAlign: "center" },
  button: { paddingHorizontal: 32, paddingVertical: 16, borderRadius: 100 },
  buttonText: { fontFamily: fonts.krona, fontSize: 18, color: "#fff" },
  statusText: { position: "absolute" },
});
