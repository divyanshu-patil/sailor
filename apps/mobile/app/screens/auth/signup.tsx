import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import React from "react";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/store/auth-store";

const SignUpScreen = () => {
  const router = useRouter();
  const { signUp, socialLogin, isLoading } = useAuthStore();

  const handleSignUp = async () => {
    try {
      // Using mock for now - replace with actual credentials
      await signUp({
        email: "test@example.com",
        password: "password123",
        name: "Test User",
      });
      router.replace("/(authenticated)" as any);
    } catch (error) {
      console.error("Sign up failed:", error);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      await socialLogin("apple");
      router.replace("/(authenticated)" as any);
    } catch (error) {
      console.error("Apple sign in failed:", error);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await socialLogin("google");
      router.replace("/(authenticated)" as any);
    } catch (error) {
      console.error("Google sign in failed:", error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign Up</Text>
      <Text style={styles.subtitle}>Create your account!</Text>

      <TouchableOpacity
        style={styles.socialButton}
        onPress={handleAppleSignIn}
        disabled={isLoading}
      >
        <Text style={styles.socialButtonText}>Sign up with Apple</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.socialButton}
        onPress={handleGoogleSignIn}
        disabled={isLoading}
      >
        <Text style={styles.socialButtonText}>Sign up with Google</Text>
      </TouchableOpacity>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={handleSignUp}
        disabled={isLoading}
      >
        <Text style={styles.primaryButtonText}>
          {isLoading ? "Loading..." : "Sign up with Email"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.linkButton}
        onPress={() => router.push("/(unauthenticated)/login" as any)}
      >
        <Text style={styles.linkText}>Already have an account? Login</Text>
      </TouchableOpacity>
    </View>
  );
};

export default SignUpScreen;

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
  },
  socialButton: {
    width: "100%",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    alignItems: "center",
    marginBottom: 12,
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#ddd",
  },
  dividerText: {
    marginHorizontal: 16,
    color: "#666",
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
