import { StyleSheet, Text, View } from "react-native";
import React from "react";
import { GenerationState } from "@/screens/presentation/hooks/use-script-generation";
import { useHeaderHeight } from "expo-router/build/react-navigation";
import CtaButton from "../../../components/cta-button";
import { fonts } from "@/constants/fonts";
import StatusText from "../../../preview/components/generating/components/status-text";
import { getGeneratingMessages } from "../../../preview/components/generating/utils/get-generation-messages";
import { useColors } from "@/constants/theme";

interface GeneratingScreenProps {
  status: GenerationState;
  error?: string | null;
  onStop: () => void;
}

const GeneratingScreen = ({ onStop, status, error }: GeneratingScreenProps) => {
  const headerHeight = useHeaderHeight();

  // In a real app, you'd get this from the job status
  const { colors } = useColors();
  return (
    <View style={[styles.container, { paddingTop: headerHeight }]}>
      {/* Status Text - Top Center */}
      <StatusText
        labels={getGeneratingMessages(status, "Your Script is Ready")}
        accentColor={colors.rust}
      />

      {/* Mascot Placeholder - Center */}
      <View style={styles.mascotContainer}>
        <View style={styles.mascotPlaceholder}>
          <Text style={styles.mascotEmoji}>🎴</Text>
        </View>
      </View>

      {/* CTA Button - Bottom Left */}

      {/* {status !== "completed" && ( */}
      <CtaButton containerStyles={styles.ctaStyle} onPress={onStop}>
        {status === "cancelled" ? "Stopped" : "Stop"}
      </CtaButton>
      {/* )} */}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
};

export default GeneratingScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: "relative",
  },
  statusContainer: {
    position: "absolute",
    top: 60,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  statusText: {
    fontFamily: fonts.krona,
    fontSize: 20,
    color: "#fff",
    textAlign: "center",
  },
  mascotContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  mascotPlaceholder: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  mascotEmoji: {
    fontSize: 80,
  },
  ctaContainer: {},
  ctaStyle: {
    position: "absolute",
    bottom: 30,
    left: 20,
  },
  errorContainer: {
    position: "absolute",
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: "rgba(255, 0, 0, 0.2)",
    padding: 16,
    borderRadius: 12,
  },
  errorText: {
    color: "#fff",
    fontSize: 14,
  },
});
