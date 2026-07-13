import React from "react";
import { StyleSheet, TextInput, View, Text as RNText } from "react-native";
import { useSignupForm } from "./form-context";
import { Host, Text, VStack } from "@expo/ui/swift-ui";
import { font, foregroundStyle, frame } from "@expo/ui/swift-ui/modifiers";
import { fonts } from "@/constants/fonts";

export default function StepEmail() {
  const {
    emailState,
    setEmailState,
    emailValidationRequested,
    setEmailValidationRequested,
  } = useSignupForm();

  return (
    <View style={styles.container}>
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
              What's your email?
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
              We'll send a verification code to this email.
            </Text>
          </VStack>
        </VStack>
      </Host>

      <TextInput
        placeholder="name@example.com"
        value={emailState}
        onChangeText={(text) => {
          setEmailState(text);

          if (emailValidationRequested) {
            setEmailValidationRequested(false);
          }
        }}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        returnKeyType="next"
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 30,
    paddingTop: 40,
    gap: 16,
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
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 20,
    fontFamily: fonts.alanSans.regular,
  },
  // inputError: {
  //   borderColor: "#d32f2f",
  // },
  // error: {
  //   marginTop: 8,
  //   fontSize: 13,
  //   color: "#d32f2f",
  //   borderRadius: 50,
  //   paddingHorizontal: 15,
  //   fontFamily: fonts.alanSans.regular,
  //   backgroundColor: "#f8d7da",
  //   paddingVertical: 10,
  //   alignSelf: "flex-start",
  // },
});
