import { fonts } from "@/constants/fonts";
import { useColors } from "@/constants/theme";
import { ScrollView, StyleSheet, Text } from "react-native";

interface ResultsScreenProps {
  title: string;
  script: string;
}

const ResultsScreen = ({ title, script }: ResultsScreenProps) => {
  const { colors } = useColors();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.container}
    >
      <Text style={[styles.title, { color: colors.rust }]}>{title}</Text>
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
  },
  script: {
    marginTop: 20,
    fontFamily: fonts.newsreader.regular,
    fontSize: 20,
    // textAlign: "center",
  },
});
