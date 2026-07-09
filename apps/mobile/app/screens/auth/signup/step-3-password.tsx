import React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { useSignupForm } from "./form-context";
import { MIN_PASSWORD_LENGTH } from "./types/types";

export default function StepPassword() {
  const { passwordState, setPasswordState, isPasswordValid, errorMessage } =
    useSignupForm();

  const showHint = passwordState.length > 0 && !isPasswordValid;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Set a password</Text>
        <Text style={styles.subtitle}>
          At least {MIN_PASSWORD_LENGTH} characters.
        </Text>
      </View>

      <TextInput
        placeholder="Password"
        value={passwordState}
        onChangeText={setPasswordState}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        returnKeyType="done"
        style={[styles.input, showHint && styles.inputError]}
      />

      {showHint && (
        <Text style={styles.error}>
          Password must be at least {MIN_PASSWORD_LENGTH} characters.
        </Text>
      )}

      {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

      {/* Clerk CAPTCHA */}
      <View nativeID="clerk-captcha" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 30,
    paddingTop: 40,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
    color: "#666",
  },
  input: {
    height: 52,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: "#FFF",
  },
  inputError: {
    borderColor: "#d32f2f",
  },
  error: {
    marginTop: 8,
    fontSize: 13,
    color: "#d32f2f",
  },
});
