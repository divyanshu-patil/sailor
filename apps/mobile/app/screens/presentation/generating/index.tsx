import { StyleSheet, View } from "react-native";
import CtaButton from "./components/cta-button";
import StatusText from "./components/status-text";
import { useHeaderHeight } from "expo-router/build/react-navigation";
import { GenerationState } from "../hooks/use-script-generation";
import { generatingMessages } from "./constants";

interface GeneratingScreenProps {
  status: GenerationState;
  error?: string | null;
  onStop: () => void;
}

const getGeneratingMessages = (status: GenerationState): string[] => {
  if (status === "failed") {
    return ["Failed to Generate Script, try again later"];
  } else if (status === "generating") {
    return generatingMessages;
  } else if (status === "cancelled") {
    return ["cancelled"];
  } else return generatingMessages;
};

const GeneratingScreen = ({ onStop, status }: GeneratingScreenProps) => {
  const headerHeight = useHeaderHeight();
  return (
    <View style={[{ paddingTop: headerHeight + 20 }, styles.container]}>
      <StatusText
        labels={getGeneratingMessages(status)}
        containerStyles={[styles.textStyles]}
        accentColors={["#B75C5C"]}
      />
      <CtaButton containerStyles={styles.ctaStyle} onPress={onStop}>
        {status === "cancelled" ? "Stopped" : "Stop"}
      </CtaButton>
    </View>
  );
};

export default GeneratingScreen;

const styles = StyleSheet.create({
  container: {
    position: "relative",
    // justifyContent: "center",
    alignItems: "flex-start",
    flex: 1,
    paddingHorizontal: 20,
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
