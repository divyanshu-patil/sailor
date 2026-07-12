import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";

const ForgotPasswordScreen = () => {
  const router = useRouter();

  const handleResetPassword = () => {
    // TODO: Implement password reset logic
    console.log("Password reset requested");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Forgot Password</Text>
      <Text style={styles.subtitle}>
        {
          "Enter your email address and we'll send you a link to reset your password."
        }
      </Text>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={handleResetPassword}
      >
        <Text style={styles.primaryButtonText}>Send Reset Link</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.linkButton}
        onPress={() => router.push("/(unauthenticated)/login" as any)}
      >
        <Text style={styles.linkText}>Back to Login</Text>
      </TouchableOpacity>
    </View>
  );
};

export default ForgotPasswordScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 32,
    textAlign: "center",
  },
  primaryButton: {
    width: "100%",
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#208AEF",
    alignItems: "center",
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  linkButton: {
    marginTop: 16,
  },
  linkText: {
    fontSize: 14,
    color: "#208AEF",
  },
});
