import { StyleSheet, View } from "react-native";
import CtaButton from "../../../components/cta-button";
import { GenerationState } from "../../../../hooks/use-script-generation";

interface GeneratingScreenProps {
  status: GenerationState;
  error?: string | null;
  onStop: () => void;
}

/**
 * @description
 * mascot and stop button will be placed here
 */
const GeneratingScreen = ({ onStop, status }: GeneratingScreenProps) => {
  return (
    <View style={[styles.container]}>
      {status !== "completed" && (
        <CtaButton containerStyles={styles.ctaStyle} onPress={onStop}>
          {status === "cancelled" ? "Stopped" : "Stop"}
        </CtaButton>
      )}
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
