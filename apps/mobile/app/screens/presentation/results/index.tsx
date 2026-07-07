import { fonts } from "@/constants/fonts";
import { ScrollView, StyleSheet, Text } from "react-native";

interface ResultsScreenProps {
  title: string;
  script: string;
}

const ResultsScreen = ({ title, script }: ResultsScreenProps) => {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.container}
    >
      <Text style={[styles.title]}>{title}</Text>
      <Text style={[styles.script]}>{script}</Text>
    </ScrollView>
  );
};

export default ResultsScreen;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 30,
  },
  title: {
    fontFamily: fonts.krona,
    fontSize: 28,
    textAlign: "center",
    color: "#B75C5C",
  },
  script: {
    marginTop: 20,
    fontFamily: fonts.newsreader.regular,
    fontSize: 20,
    // textAlign: "center",
  },
});
