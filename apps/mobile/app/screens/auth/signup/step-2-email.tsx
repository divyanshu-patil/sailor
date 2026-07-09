import React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { useSignupForm } from "./form-context";

export default function StepEmail() {
  const { emailState, setEmailState, isEmailValid } = useSignupForm();

  const showError = emailState.length > 0 && !isEmailValid;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>What's your email?</Text>
        <Text style={styles.subtitle}>
          We'll send a verification code here.
        </Text>
      </View>

      <TextInput
        placeholder="name@example.com"
        value={emailState}
        onChangeText={setEmailState}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        returnKeyType="next"
        style={[styles.input, showError && styles.inputError]}
      />

      {showError && (
        <Text style={styles.error}>Enter a valid email address.</Text>
      )}
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
