import { fonts } from "@/constants/fonts";
import { useColors } from "@/constants/theme";
import { useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text } from "react-native";

type ResultsScreenParams = {
  jobId: string;
};

const ResultsScreen = () => {
  const { colors } = useColors();
  const { jobId } = useLocalSearchParams<ResultsScreenParams>();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.container}
    >
      <Text style={[styles.title, { color: colors.rust }]}>{jobId}</Text>
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
