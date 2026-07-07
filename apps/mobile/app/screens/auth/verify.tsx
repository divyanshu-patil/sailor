import { View, Pressable, StyleSheet, TextInput } from "react-native";
import React, { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { useSignIn, useSignUp } from "@clerk/expo";
import { Href, useRouter } from "expo-router";

// This screen is shared by two different Clerk flows:
//  - Sign-in second factor (email code) -> useSignIn / signIn.mfa.*
//  - Sign-up email verification          -> useSignUp / signUp.verifications.*
// It figures out which one is actually in progress and branches accordingly,
// so both login.tsx and signup.tsx can push the same "/verify" route.
export default function Verify() {
  const {
    signIn,
    errors: signInErrors,
    fetchStatus: signInFetchStatus,
  } = useSignIn();
  const {
    signUp,
    errors: signUpErrors,
    fetchStatus: signUpFetchStatus,
  } = useSignUp();
  const router = useRouter();
  const [code, setCode] = useState("");

  // If a sign-in MFA flow is active, show that first.
  // Otherwise continue with email verification for sign-up.
  const isSignInFlow = signIn.status === "needs_second_factor";
  const mode: "signIn" | "signUp" = isSignInFlow ? "signIn" : "signUp";

  const fetchStatus = mode === "signIn" ? signInFetchStatus : signUpFetchStatus;
  const codeError =
    mode === "signIn" ? signInErrors.fields.code : signUpErrors.fields.code;

  const navigateHome = (
    session: any,
    decorateUrl: (path: string) => string,
  ) => {
    if (session?.currentTask) {
      console.log(session?.currentTask);
      return;
    }
    const url = decorateUrl("/");
    if (url.startsWith("http")) {
      window.location.href = url;
    } else {
      router.push(url as Href);
    }
  };

  const handleVerify = async () => {
    if (mode === "signIn") {
      await signIn.mfa.verifyEmailCode({ code });

      if (signIn.status === "complete") {
        await signIn.finalize({
          navigate: ({ session, decorateUrl }) =>
            navigateHome(session, decorateUrl),
        });
      } else {
        console.error("Sign-in attempt not complete:", signIn);
      }
    } else {
      await signUp.verifications.verifyEmailCode({ code });

      if (signUp.status === "complete") {
        await signUp.finalize({
          navigate: ({ session, decorateUrl }) =>
            navigateHome(session, decorateUrl),
        });
      } else {
        console.error("Sign-up attempt not complete:", signUp);
      }
    }
  };

  const handleResend = () => {
    if (mode === "signIn") {
      signIn.mfa.sendEmailCode();
    } else {
      signUp.verifications.sendEmailCode();
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <ThemedView style={styles.container}>
        <ThemedText
          type="title"
          style={[styles.title, { fontSize: 24, fontWeight: "bold" }]}
        >
          Verify your account
        </ThemedText>
        <TextInput
          style={styles.input}
          value={code}
          placeholder="Enter your verification code"
          placeholderTextColor="#666666"
          onChangeText={setCode}
          keyboardType="numeric"
        />
        {codeError && (
          <ThemedText style={styles.error}>{codeError.message}</ThemedText>
        )}
        <Pressable
          style={({ pressed }) => [
            styles.button,
            fetchStatus === "fetching" && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleVerify}
          disabled={fetchStatus === "fetching"}
        >
          <ThemedText style={styles.buttonText}>Verify</ThemedText>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleResend}
        >
          <ThemedText style={styles.secondaryButtonText}>
            I need a new code
          </ThemedText>
        </Pressable>
        {mode === "signIn" && (
          <Pressable
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => signIn.reset()}
          >
            <ThemedText style={styles.secondaryButtonText}>
              Start over
            </ThemedText>
          </Pressable>
        )}
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 12 },
  title: { marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  button: {
    backgroundColor: "#0a7ea4",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  buttonPressed: { opacity: 0.7 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontWeight: "600" },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  secondaryButtonText: { color: "#0a7ea4", fontWeight: "600" },
  error: { color: "#d32f2f", fontSize: 12, marginTop: -8 },
});
