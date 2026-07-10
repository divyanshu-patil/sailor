import React from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { useSignupForm } from "./form-context";
import { Host, Text, VStack } from "@expo/ui/swift-ui";
import {
  Animation,
  animation,
  contentTransition,
  font,
  foregroundStyle,
  frame,
  multilineTextAlignment,
} from "@expo/ui/swift-ui/modifiers";
import { fonts } from "@/constants/fonts";

export default function StepName() {
  const { firstNameState, lastNameState, setFirstNameState, setLastNameState } =
    useSignupForm();

  return (
    <View style={styles.container}>
      {/* <TextInput
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
      /> */}

      <Host matchContents={{ vertical: true }}>
        <VStack>
          <VStack
            modifiers={[
              frame({
                maxWidth: Infinity,
                alignment: "leading",
              }),
            ]}
          >
            <Text
              modifiers={[
                font({
                  family: fonts.alanSans.bold,
                  design: "rounded",
                  size: 30,
                }),
              ]}
            >
              What's your name?
            </Text>
          </VStack>
          <VStack
            modifiers={[
              frame({
                maxWidth: Infinity,
                alignment: "leading",
              }),
            ]}
          >
            <Text
              modifiers={[
                foregroundStyle("#44444ec5"),
                font({
                  family: fonts.alanSans.semiBold,
                  design: "rounded",
                  size: 22,
                }),
              ]}
            >
              Please enter your first and last name.
            </Text>
          </VStack>
        </VStack>
      </Host>
      <TextInput
        placeholder="First name"
        value={firstNameState}
        onChangeText={setFirstNameState}
        style={styles.input}
        autoCorrect={false}
        autoComplete="given-name"
        returnKeyType="done"
      />
      <TextInput
        placeholder="Last name (Optional)"
        value={lastNameState}
        onChangeText={setLastNameState}
        style={[styles.input, styles.extra]}
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
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 20,
    fontFamily: fonts.alanSans.regular,
  },
  extra: {
    height: 30,
  },
});
