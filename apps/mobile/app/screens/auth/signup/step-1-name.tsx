import React from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { useSignupForm } from "./form-context";

export default function StepName() {
  const { firstNameState, lastNameState, setFirstNameState, setLastNameState } =
    useSignupForm();

  return (
    <View style={styles.container}>
      <TextInput
        placeholder="First name"
        value={firstNameState}
        onChangeText={setFirstNameState}
        style={styles.input}
        autoCorrect={false}
        autoComplete="given-name"
        returnKeyType="next"
      />

      <TextInput
        placeholder="Last name"
        value={lastNameState}
        onChangeText={setLastNameState}
        style={styles.input}
        autoCorrect={false}
        autoComplete="family-name"
        returnKeyType="done"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 16,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: "#FFF",
  },
});
