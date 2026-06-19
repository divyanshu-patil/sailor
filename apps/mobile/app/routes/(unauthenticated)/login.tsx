import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import React from "react";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/store/auth-store";

const Login = () => {
  const router = useRouter();
  const { login, socialLogin, isLoading, devLogin } = useAuthStore();

  const handleLogin = async () => {
    // DEV_MODE quick login - set DEV_MODE = true in auth-store.ts
    devLogin();

    // Check if dev login succeeded (user is now authenticated)
    if (useAuthStore.getState().isAuthenticated) {
      router.replace("/(authenticated)" as any);
      return;
    }

    try {
      // Using mock for now - replace with actual credentials
      await login({ email: "test@example.com", password: "password123" });
      router.replace("/(authenticated)" as any);
    } catch (error) {
      console.error("Login failed:", error);
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
      <Text style={styles.title}>Login</Text>
      <Text style={styles.subtitle}>Welcome back!</Text>

      <TouchableOpacity
        style={styles.socialButton}
        onPress={handleAppleSignIn}
        disabled={isLoading}
      >
        <Text style={styles.socialButtonText}>Sign in with Apple</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.socialButton}
        onPress={handleGoogleSignIn}
        disabled={isLoading}
      >
        <Text style={styles.socialButtonText}>Sign in with Google</Text>
      </TouchableOpacity>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={handleLogin}
        disabled={isLoading}
      >
        <Text style={styles.primaryButtonText}>
          {isLoading ? "Loading..." : "Login with Email"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.linkButton}
        onPress={() => router.push("/(unauthenticated)/signup" as any)}
      >
        <Text style={styles.linkText}>Don't have an account? Sign up</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.linkButton}
        onPress={() => router.push("/(unauthenticated)/forgot-password" as any)}
      >
        <Text style={styles.linkText}>Forgot Password?</Text>
      </TouchableOpacity>
    </View>
  );
};

export default Login;

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