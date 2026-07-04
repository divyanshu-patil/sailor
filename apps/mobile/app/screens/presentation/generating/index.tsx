import { StyleSheet, View } from "react-native";
import CtaButton from "./components/cta-button";
import StatusText from "./components/status-text";
import { useHeaderHeight } from "expo-router/build/react-navigation";
import BlobBackground from "./components/background";

const GeneratingScreen = () => {
  const headerHeight = useHeaderHeight();
  return (
    <View style={[{ paddingTop: headerHeight + 20 }, styles.container]}>
      <BlobBackground />
      <StatusText
        labels={[]}
        containerStyles={[styles.textStyles]}
        accentColor={"#B75C5C"}
      />
      <CtaButton containerStyles={styles.ctaStyle}>Stop</CtaButton>
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
    backgroundColor: "#FFF4E8",
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
