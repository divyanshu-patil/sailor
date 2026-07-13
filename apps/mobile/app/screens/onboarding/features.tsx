import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import React from "react";
import { useRouter } from "expo-router";
import { useAppStore } from "@/store/auth-store";

const { width } = Dimensions.get("window");

const features = [
  {
    icon: "🚀",
    title: "Fast & Easy",
    description: "Get started in minutes with our simple onboarding process",
  },
  {
    icon: "🔒",
    title: "Secure",
    description: "Your data is protected with enterprise-grade security",
  },
  {
    icon: "⚡",
    title: "Powerful",
    description: "Access all features with just a few taps",
  },
];

const FeaturesScreen = () => {
  const router = useRouter();
  const { completeOnboarding } = useAppStore();

  const handleContinue = () => {
    // TODO: chnage this to no parameter once onbaording screen done
    // completeOnboarding();
    completeOnboarding(true);
    router.replace("/(unauthenticated)" as any);
  };

  const handleSkip = () => {
    // TODO: chnage this to no parameter once onbaording screen done
    // completeOnboarding();
    completeOnboarding(true);
    router.replace("/(unauthenticated)" as any);
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.header}>{"What you'll get"}</Text>

        <View style={styles.features}>
          {features.map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <View style={styles.featureIcon}>
                <Text style={styles.featureIconText}>{feature.icon}</Text>
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>
                  {feature.description}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.primaryButton} onPress={handleContinue}>
          <Text style={styles.primaryButtonText}>Continue</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkButton} onPress={handleSkip}>
          <Text style={styles.linkText}>Skip</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default FeaturesScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    padding: 24,
    backgroundColor: "#fff",
    paddingTop: 60,
  },
  content: {
    flex: 1,
  },
  header: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 32,
  },
  features: {
    flex: 1,
    justifyContent: "center",
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  featureIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  featureIconText: {
    fontSize: 28,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  footer: {
    paddingBottom: 24,
  },
  primaryButton: {
    width: "100%",
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#208AEF",
    alignItems: "center",
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  linkButton: {
    marginTop: 16,
    alignItems: "center",
  },
  linkText: {
    fontSize: 14,
    color: "#999",
  },
});
