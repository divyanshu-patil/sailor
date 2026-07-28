import { StyleSheet, View } from "react-native";
import CtaButton from "../../../components/cta-button";
import { GenerationState } from "../../../../hooks/use-script-generation";

interface GeneratingScreenProps {
  status: GenerationState;
  error?: string | null;
  onStop: () => void;
  /** Re-run the job. Omitted where there's nothing sensible to retry. */
  onRetry?: () => void;
}

/**
 * The overlay shown while a job runs, and after it stops.
 *
 * "failed" and "cancelled" are terminal, but used to render the same Stop button
 * as a running job — so a job that had already died was indistinguishable from
 * one still working, and the only thing on offer was to stop something already
 * stopped. Both now offer Try again, which is the only action that means
 * anything from either state.
 *
 * mascot goes here too.
 */
const GeneratingScreen = ({
  onStop,
  onRetry,
  status,
}: GeneratingScreenProps) => {
  if (status === "completed") return null;

  const isTerminal = status === "failed" || status === "cancelled";

  return (
    <View style={[styles.container]}>
      <CtaButton
        containerStyles={styles.ctaStyle}
        onPress={isTerminal ? (onRetry ?? onStop) : onStop}
      >
        {isTerminal ? "Try again" : "Stop"}
      </CtaButton>
    </View>
  );
};

export default GeneratingScreen;

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    // justifyContent: "center",
    alignItems: "flex-start",
    flex: 1,
    // paddingHorizontal: 20,
    // paddingVertical: 80,
  },
  text: {
    fontSize: 36,
  },
  ctaStyle: {
    position: "absolute",
    bottom: 20,
    left: 20,
  },
  textStyles: {},
});
