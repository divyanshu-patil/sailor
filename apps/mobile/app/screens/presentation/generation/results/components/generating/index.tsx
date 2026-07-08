import { StyleSheet, Text, View } from "react-native";
import React from "react";
import { GenerationState } from "@/screens/presentation/hooks/use-script-generation";
import { useHeaderHeight } from "expo-router/build/react-navigation";
import CtaButton from "../../../components/cta-button";

interface GeneratingScreenProps {
  status: GenerationState;
  error?: string | null;
  onStop: () => void;
}

const GeneratingScreen = ({ onStop, status, error }: GeneratingScreenProps) => {
  const headerHeight = useHeaderHeight();
  return (
    <View style={[styles.container, { paddingTop: headerHeight }]}>
      <Text>Generating</Text>
      <CtaButton onPress={onStop}>
        {status === "cancelled" ? "Stopped" : "Stop"}
      </CtaButton>
    </View>
  );
};

export default GeneratingScreen;

const styles = StyleSheet.create({
  container: {},
});
